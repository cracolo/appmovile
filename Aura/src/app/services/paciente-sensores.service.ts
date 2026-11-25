import { Injectable, signal, computed } from '@angular/core';
import { PluginListenerHandle } from '@capacitor/core';
import {
  Motion,
  AccelListenerEvent,
  OrientationListenerEvent,
} from '@capacitor/motion';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuraDataService, LecturaGiroscopio } from './aura-data.service';

export type FaseDeteccion =
  | 'inactivo'
  | 'monitoreando'
  | 'evaluando_inmovilidad'
  | 'confirmando_usuario'
  | 'alerta_enviada';

interface MuestraOrientacion {
  beta: number;
  gamma: number;
  ts: number;
}

interface CandidatoCaida {
  inicioMs: number;
  picoAceleracion: number;
  picoRotacion: number;
  tuvoCaidaLibre: boolean;
  betaPre: number;
  gammaPre: number;
  muestrasMovimientoPost: number;
  origen: string;
  cambioAngulo: number;
}

@Injectable({ providedIn: 'root' })
export class PacienteSensoresService {
  private accelHandle: PluginListenerHandle | null = null;
  private orientationHandle: PluginListenerHandle | null = null;
  private geoWatchId: string | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  private audioCtx: AudioContext | null = null;
  private inmovilidadTimer: ReturnType<typeof setInterval> | null = null;
  private confirmacionTimer: ReturnType<typeof setInterval> | null = null;
  private alertaEnviadaTimer: ReturnType<typeof setTimeout> | null = null;

  // Historial reciente de orientación (últimos 2.5s) para comparar postura pre vs post impacto
  private historialOrientacion: MuestraOrientacion[] = [];
  private ultimaCaidaLibreMs = 0;
  private ultimoEventoMs = 0;
  private candidatoActual: CandidatoCaida | null = null;

  // Parámetros de la máquina de estados en 4 fases
  private readonly COOLDOWN_EVENTO_MS = 8000;
  private readonly UMBRAL_CAIDA_LIBRE_MS2 = 5.8;
  private readonly VENTANA_CAIDA_LIBRE_MS = 900;
  private readonly UMBRAL_IMPACTO_ACEL_MS2 = 22;
  private readonly UMBRAL_IMPACTO_COMBINADO_ACEL = 18;
  private readonly UMBRAL_IMPACTO_COMBINADO_ROT = 150;
  private readonly UMBRAL_IMPACTO_ROT_SOLA = 220;
  private readonly REBOTE_INICIAL_MS = 600;
  private readonly VENTANA_INMOVILIDAD_MS = 3500;
  private readonly UMBRAL_CAMBIO_ANGULO_DEG = 40;
  private readonly SEGUNDOS_CONFIRMACION = 12;

  private _giroscopioActivo = signal(false);
  private _gpsActivo = signal(false);
  private _pantallaActiva = signal(false);
  private _fase = signal<FaseDeteccion>('inactivo');
  private _segundosInmovilidadRestantes = signal(0);
  private _segundosConfirmacion = signal(0);
  private _ultimoDiagnostico = signal(
    'Activa el giroscopio para iniciar la detección inteligente de caídas.'
  );
  private _resumenConfirmacion = signal('');
  private _lectura = signal<LecturaGiroscopio>({
    alpha: 0,
    beta: 0,
    gamma: 0,
    aceleracion: 9.8,
    rotacion: 0,
    fechaTexto: 'Sin lecturas aún',
  });
  private _mensajeEstado = signal<string>('Sensores en espera');
  private _errorSensor = signal<string>('');
  private _eventosDetectadosSesion = signal<number>(0);

  readonly giroscopioActivo = computed(() => this._giroscopioActivo());
  readonly gpsActivo = computed(() => this._gpsActivo());
  readonly pantallaActiva = computed(() => this._pantallaActiva());
  readonly fase = computed(() => this._fase());
  readonly segundosInmovilidadRestantes = computed(() =>
    this._segundosInmovilidadRestantes()
  );
  readonly segundosConfirmacion = computed(() => this._segundosConfirmacion());
  readonly ultimoDiagnostico = computed(() => this._ultimoDiagnostico());
  readonly resumenConfirmacion = computed(() => this._resumenConfirmacion());
  readonly lectura = computed(() => this._lectura());
  readonly mensajeEstado = computed(() => this._mensajeEstado());
  readonly errorSensor = computed(() => this._errorSensor());
  readonly eventosDetectadosSesion = computed(() =>
    this._eventosDetectadosSesion()
  );

  readonly etiquetaFase = computed(() => {
    switch (this._fase()) {
      case 'inactivo':
        return 'Apagado';
      case 'monitoreando':
        return 'Monitoreo normal';
      case 'evaluando_inmovilidad':
        return `Evaluando postura e inmovilidad (${this._segundosInmovilidadRestantes()}s)`;
      case 'confirmando_usuario':
        return `Esperando confirmación (${this._segundosConfirmacion()}s)`;
      case 'alerta_enviada':
        return '¡Alerta crítica enviada!';
    }
  });

  constructor(private auraData: AuraDataService) {}

  /** Desbloquea el AudioContext tras un gesto del usuario (necesario en Android WebView) */
  private prepararAudio() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
    } catch {
      // Ignorar si Web Audio no está disponible
    }
  }

  private emitirPitidoAlerta(urgente = false) {
    try {
      this.prepararAudio();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = urgente ? 'square' : 'sine';
      osc.frequency.setValueAtTime(
        urgente ? 980 : 780,
        this.audioCtx.currentTime
      );

      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.22,
        this.audioCtx.currentTime + 0.03
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + 0.35
      );

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.36);
    } catch {
      // Ignorar si el navegador bloquea audio
    }
  }

  private async vibrarAlerta() {
    try {
      await Haptics.vibrate({ duration: 400 });
    } catch {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Fallback silencioso en PC sin vibración
      }
    }
  }

  /** Activa o desactiva el monitoreo de giroscopio y acelerómetro */
  async alternarGiroscopio(): Promise<void> {
    if (this._giroscopioActivo()) {
      await this.detenerGiroscopio();
    } else {
      await this.iniciarGiroscopio();
    }
  }

  async iniciarGiroscopio(): Promise<void> {
    this._errorSensor.set('');
    this.prepararAudio();

    try {
      const deviceMotionCtor = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof deviceMotionCtor?.requestPermission === 'function') {
        const perm = await deviceMotionCtor.requestPermission();
        if (perm !== 'granted') {
          this._errorSensor.set(
            'Permiso de sensores de movimiento denegado por el dispositivo.'
          );
          return;
        }
      }

      this.orientationHandle = await Motion.addListener(
        'orientation',
        (event: OrientationListenerEvent) => {
          const alpha = this.redondear(event.alpha ?? 0);
          const beta = this.redondear(event.beta ?? 0);
          const gamma = this.redondear(event.gamma ?? 0);
          const ahora = Date.now();

          this.historialOrientacion.push({ beta, gamma, ts: ahora });
          const limite = ahora - 2800;
          while (
            this.historialOrientacion.length > 0 &&
            this.historialOrientacion[0].ts < limite
          ) {
            this.historialOrientacion.shift();
          }

          const actual = this._lectura();
          this._lectura.set({
            alpha,
            beta,
            gamma,
            aceleracion: actual.aceleracion,
            rotacion: actual.rotacion,
            fechaTexto: this.auraData.formatearFecha(new Date()),
          });
        }
      );

      this.accelHandle = await Motion.addListener(
        'accel',
        (event: AccelListenerEvent) => {
          const ax = event.accelerationIncludingGravity?.x ?? 0;
          const ay = event.accelerationIncludingGravity?.y ?? 0;
          const az = event.accelerationIncludingGravity?.z ?? 0;
          const magnitud = this.redondear(
            Math.sqrt(ax * ax + ay * ay + az * az)
          );

          const rotAlpha = Math.abs(event.rotationRate?.alpha ?? 0);
          const rotBeta = Math.abs(event.rotationRate?.beta ?? 0);
          const rotGamma = Math.abs(event.rotationRate?.gamma ?? 0);
          const picoRotacion = this.redondear(
            Math.max(rotAlpha, rotBeta, rotGamma)
          );

          const actual = this._lectura();
          const nuevaLectura: LecturaGiroscopio = {
            alpha: actual.alpha,
            beta: actual.beta,
            gamma: actual.gamma,
            aceleracion: magnitud,
            rotacion: picoRotacion,
            fechaTexto: this.auraData.formatearFecha(new Date()),
          };
          this._lectura.set(nuevaLectura);

          this.evaluarMuestra(magnitud, picoRotacion);
        }
      );

      this._giroscopioActivo.set(true);
      this._fase.set('monitoreando');
      this._mensajeEstado.set(
        'Detección inteligente activa (4 fases + confirmación)'
      );
      this._ultimoDiagnostico.set(
        'Monitoreo normal: buscando patrón de caída real.'
      );
      await this.auraData.actualizarEstadoSensores({
        giroscopioActivo: true,
        ultimaLectura: this._lectura(),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo iniciar el giroscopio';
      this._errorSensor.set(
        `No se detectó sensor físico o falta permiso (${msg}). Puedes usar los botones de simulación abajo.`
      );
    }
  }

  async detenerGiroscopio(): Promise<void> {
    this.limpiarTimersDeteccion();
    if (this.accelHandle) {
      await this.accelHandle.remove();
      this.accelHandle = null;
    }
    if (this.orientationHandle) {
      await this.orientationHandle.remove();
      this.orientationHandle = null;
    }
    this.candidatoActual = null;
    this.historialOrientacion = [];
    this._giroscopioActivo.set(false);
    this._fase.set('inactivo');
    this._mensajeEstado.set('Giroscopio detenido');
    this._ultimoDiagnostico.set('Giroscopio apagado.');
    await this.auraData.actualizarEstadoSensores({
      giroscopioActivo: false,
    });
  }

  // --- Máquina de estados física en 4 fases ---

  private evaluarMuestra(magnitud: number, picoRotacion: number): void {
    const ahora = Date.now();
    const faseActual = this._fase();

    if (faseActual === 'confirmando_usuario' || faseActual === 'alerta_enviada') {
      return;
    }

    // Fase 1: Registrar caída libre breve (< 5.8 m/s²)
    if (faseActual === 'monitoreando') {
      if (magnitud <= this.UMBRAL_CAIDA_LIBRE_MS2) {
        this.ultimaCaidaLibreMs = ahora;
      }

      if (ahora - this.ultimoEventoMs < this.COOLDOWN_EVENTO_MS) {
        return;
      }

      // Fase 2: Detectar impacto fuerte o impacto + rotación brusca
      const impactoFuerte =
        magnitud >= this.UMBRAL_IMPACTO_ACEL_MS2 ||
        (magnitud >= this.UMBRAL_IMPACTO_COMBINADO_ACEL &&
          picoRotacion >= this.UMBRAL_IMPACTO_COMBINADO_ROT) ||
        picoRotacion >= this.UMBRAL_IMPACTO_ROT_SOLA;

      if (impactoFuerte) {
        this.iniciarEvaluacionPostImpacto(
          magnitud,
          picoRotacion,
          'Giroscopio del paciente'
        );
      }
      return;
    }

    // Fase 4 (en curso): Evaluar quietud/inmovilidad durante 3.5s post-impacto
    if (faseActual === 'evaluando_inmovilidad' && this.candidatoActual) {
      const transcurrido = ahora - this.candidatoActual.inicioMs;

      // Primeros 600ms: absorber rebotes del propio impacto y guardar el pico real
      if (transcurrido <= this.REBOTE_INICIAL_MS) {
        if (magnitud > this.candidatoActual.picoAceleracion) {
          this.candidatoActual.picoAceleracion = magnitud;
        }
        if (picoRotacion > this.candidatoActual.picoRotacion) {
          this.candidatoActual.picoRotacion = picoRotacion;
        }
        return;
      }

      // Tras el rebote: si sigue habiendo movimiento fuerte, no está inmóvil en el suelo
      const enMovimiento =
        magnitud > 14.5 || magnitud < 6.0 || picoRotacion > 90;

      if (enMovimiento) {
        this.candidatoActual.muestrasMovimientoPost += 1;
        if (this.candidatoActual.muestrasMovimientoPost >= 4) {
          void this.descartarPorMovimientoPosterior();
        }
      }
    }
  }

  private iniciarEvaluacionPostImpacto(
    magnitud: number,
    picoRotacion: number,
    origen: string
  ): void {
    const ahora = Date.now();
    const orientacionPre = this.obtenerOrientacionPrevia(ahora);
    const tuvoCaidaLibre =
      ahora - this.ultimaCaidaLibreMs <= this.VENTANA_CAIDA_LIBRE_MS;

    this.candidatoActual = {
      inicioMs: ahora,
      picoAceleracion: magnitud,
      picoRotacion,
      tuvoCaidaLibre,
      betaPre: orientacionPre.beta,
      gammaPre: orientacionPre.gamma,
      muestrasMovimientoPost: 0,
      origen,
      cambioAngulo: 0,
    };

    this._fase.set('evaluando_inmovilidad');
    this._segundosInmovilidadRestantes.set(
      Math.ceil(this.VENTANA_INMOVILIDAD_MS / 1000)
    );
    this._ultimoDiagnostico.set(
      `Impacto detectado (${magnitud} m/s², ${picoRotacion}°/s). Verificando cambio de postura e inmovilidad...`
    );

    this.limpiarTimersDeteccion();
    this.inmovilidadTimer = setInterval(() => {
      if (!this.candidatoActual) {
        this.limpiarTimersDeteccion();
        return;
      }
      const restanteMs =
        this.VENTANA_INMOVILIDAD_MS -
        (Date.now() - this.candidatoActual.inicioMs);

      if (restanteMs <= 0) {
        this.limpiarTimersDeteccion();
        this.finalizarEvaluacionInmovilidad();
      } else {
        this._segundosInmovilidadRestantes.set(Math.ceil(restanteMs / 1000));
      }
    }, 250);
  }

  private async descartarPorMovimientoPosterior(): Promise<void> {
    const candidato = this.candidatoActual;
    this.limpiarTimersDeteccion();
    this.candidatoActual = null;
    this.ultimoEventoMs = Date.now();
    this._fase.set(this._giroscopioActivo() ? 'monitoreando' : 'inactivo');

    if (!candidato) return;

    // Si el golpe fue muy fuerte pero siguió caminando/moviéndose, registrar solo Tropiezo leve
    if (candidato.picoAceleracion >= 26) {
      this._eventosDetectadosSesion.update((v) => v + 1);
      this._ultimoDiagnostico.set(
        `Descartado como caída (siguió en movimiento). Registrado como Tropiezo leve (${candidato.picoAceleracion} m/s²).`
      );
      await this.auraData.registrarAlerta({
        tipoAlerta: 'Tropiezo',
        origen: candidato.origen,
        detalle: `Sacudida fuerte (${candidato.picoAceleracion} m/s², ${candidato.picoRotacion}°/s) pero el paciente siguió en movimiento.`,
        severidad: 'media',
      });
    } else {
      this._ultimoDiagnostico.set(
        `Falsa alarma descartada: se detectó movimiento normal tras el golpe (${candidato.picoAceleracion} m/s²).`
      );
    }
  }

  private finalizarEvaluacionInmovilidad(): void {
    const candidato = this.candidatoActual;
    if (!candidato) return;

    // Fase 3: Calcular cambio de postura (pre-impacto vs quietud post-impacto)
    const actual = this._lectura();
    const diffBeta = this.diferenciaAngular(candidato.betaPre, actual.beta);
    const diffGamma = this.diferenciaAngular(candidato.gammaPre, actual.gamma);
    const cambioAngulo = this.redondear(Math.max(diffBeta, diffGamma));
    candidato.cambioAngulo = cambioAngulo;

    const cumpleCriterioCaida =
      cambioAngulo >= this.UMBRAL_CAMBIO_ANGULO_DEG ||
      candidato.tuvoCaidaLibre ||
      candidato.picoAceleracion >= 28;

    if (!cumpleCriterioCaida) {
      this.candidatoActual = null;
      this.ultimoEventoMs = Date.now();
      this._fase.set(this._giroscopioActivo() ? 'monitoreando' : 'inactivo');
      this._ultimoDiagnostico.set(
        `Descartado: sin cambio relevante de postura (${cambioAngulo}°) ni caída libre (acel. ${candidato.picoAceleracion} m/s²).`
      );
      return;
    }

    // Capa 2: Pasar a verificación humana "¿Estás bien?" (12s)
    this.iniciarConfirmacionUsuario(candidato);
  }

  private iniciarConfirmacionUsuario(candidato: CandidatoCaida): void {
    this.candidatoActual = candidato;
    this._fase.set('confirmando_usuario');
    this._segundosConfirmacion.set(this.SEGUNDOS_CONFIRMACION);
    this._resumenConfirmacion.set(
      `Impacto ${candidato.picoAceleracion} m/s² · Giro ${candidato.picoRotacion}°/s · Cambio postura ${candidato.cambioAngulo}°`
    );
    this._ultimoDiagnostico.set(
      'Posible caída confirmada por sensores. Esperando respuesta del paciente...'
    );

    this.emitirPitidoAlerta(true);
    void this.vibrarAlerta();

    this.limpiarTimersDeteccion();
    this.confirmacionTimer = setInterval(() => {
      const siguiente = this._segundosConfirmacion() - 1;
      if (siguiente <= 0) {
        this.limpiarTimersDeteccion();
        void this.confirmarYEnviarCaida(false);
      } else {
        this._segundosConfirmacion.set(siguiente);
        if (siguiente % 2 === 0 || siguiente <= 3) {
          this.emitirPitidoAlerta(siguiente <= 3);
          void this.vibrarAlerta();
        }
      }
    }, 1000);
  }

  /** El paciente tocó "Estoy bien (Cancelar alerta)" */
  cancelarAlertaPaciente(): void {
    this.limpiarTimersDeteccion();
    this.candidatoActual = null;
    this.ultimoEventoMs = Date.now();
    this._segundosConfirmacion.set(0);
    this._fase.set(this._giroscopioActivo() ? 'monitoreando' : 'inactivo');
    this._ultimoDiagnostico.set(
      'Alerta cancelada manualmente por el paciente ("Estoy bien"). No se notificó al cuidador.'
    );
  }

  /** Envía la alerta crítica (manualmente si pidió ayuda o automáticamente al llegar a 0s) */
  async confirmarYEnviarCaida(manual: boolean): Promise<void> {
    const candidato = this.candidatoActual;
    this.limpiarTimersDeteccion();
    this.candidatoActual = null;
    this.ultimoEventoMs = Date.now();
    this._segundosConfirmacion.set(0);
    this._eventosDetectadosSesion.update((v) => v + 1);

    const motivo = manual
      ? 'El paciente confirmó que necesita ayuda.'
      : `Sin respuesta tras ${this.SEGUNDOS_CONFIRMACION}s de verificación.`;

    const detallesFisicos = candidato
      ? `Aceleración ${candidato.picoAceleracion} m/s², giro ${candidato.picoRotacion}°/s, cambio de postura ${candidato.cambioAngulo}°${candidato.tuvoCaidaLibre ? ', con caída libre previa' : ''}.`
      : 'Patrón de caída confirmado.';

    await this.auraData.registrarAlerta({
      tipoAlerta: 'Caída',
      origen: candidato?.origen ?? 'Giroscopio del paciente',
      detalle: `${motivo} ${detallesFisicos}`,
      severidad: 'critica',
    });

    await this.auraData.actualizarEstadoSensores({
      ultimaLectura: this._lectura(),
    });

    this._fase.set('alerta_enviada');
    this._ultimoDiagnostico.set(`¡Alerta de Caída enviada al cuidador! ${motivo}`);

    this.alertaEnviadaTimer = setTimeout(() => {
      this._fase.set(this._giroscopioActivo() ? 'monitoreando' : 'inactivo');
    }, 4500);
  }

  private obtenerOrientacionPrevia(ahora: number): { beta: number; gamma: number } {
    // Usar muestras de entre 2.5s y 0.5s antes del impacto (antes de inclinarse al caer)
    const previas = this.historialOrientacion.filter(
      (m) => m.ts <= ahora - 500 && m.ts >= ahora - 2500
    );
    const fuente =
      previas.length > 0 ? previas : this.historialOrientacion.slice(0, 5);

    if (fuente.length === 0) {
      const actual = this._lectura();
      return { beta: actual.beta, gamma: actual.gamma };
    }

    const sumaBeta = fuente.reduce((acc, m) => acc + m.beta, 0);
    const sumaGamma = fuente.reduce((acc, m) => acc + m.gamma, 0);
    return {
      beta: sumaBeta / fuente.length,
      gamma: sumaGamma / fuente.length,
    };
  }

  private diferenciaAngular(a: number, b: number): number {
    let diff = Math.abs(b - a) % 360;
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  private limpiarTimersDeteccion(): void {
    if (this.inmovilidadTimer) {
      clearInterval(this.inmovilidadTimer);
      this.inmovilidadTimer = null;
    }
    if (this.confirmacionTimer) {
      clearInterval(this.confirmacionTimer);
      this.confirmacionTimer = null;
    }
    if (this.alertaEnviadaTimer) {
      clearTimeout(this.alertaEnviadaTimer);
      this.alertaEnviadaTimer = null;
    }
  }

  // --- Geolocalización ---

  async alternarGPS(): Promise<void> {
    if (this._gpsActivo()) {
      await this.detenerGPS();
    } else {
      await this.iniciarGPS();
    }
  }

  async iniciarGPS(): Promise<void> {
    this._errorSensor.set('');

    try {
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 5000,
        },
        (position, err) => {
          if (err) {
            this._errorSensor.set(
              'No se pudo obtener el GPS real. Verifica permisos o usa "Simular ubicación".'
            );
            return;
          }
          if (position) {
            void this.auraData.actualizarUbicacion(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy ?? 15,
              'gps'
            );
            this._mensajeEstado.set(
              'Ubicación GPS compartida con el cuidador'
            );
          }
        }
      );

      this.geoWatchId = id;
      this._gpsActivo.set(true);
      await this.auraData.actualizarEstadoSensores({ gpsActivo: true });
    } catch {
      this._errorSensor.set(
        'Permiso de geolocalización no disponible en este entorno. Puedes usar "Simular ubicación".'
      );
    }
  }

  async detenerGPS(): Promise<void> {
    if (this.geoWatchId !== null) {
      await Geolocation.clearWatch({ id: this.geoWatchId });
      this.geoWatchId = null;
    }
    this._gpsActivo.set(false);
    await this.auraData.actualizarEstadoSensores({ gpsActivo: false });
  }

  // --- Mantener activo / segundo plano ---

  async alternarModoContinuo(): Promise<void> {
    if (this._pantallaActiva()) {
      await this.desactivarModoContinuo();
      return;
    }

    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
      this._pantallaActiva.set(true);
      this._mensajeEstado.set(
        'Modo monitoreo continuo activado (en APK Android se complementará con servicio en segundo plano).'
      );
      await this.auraData.actualizarEstadoSensores({ pantallaActiva: true });
    } catch {
      this._pantallaActiva.set(true);
      this._mensajeEstado.set(
        'Monitoreo continuo marcado (WakeLock no soportado por este navegador).'
      );
      await this.auraData.actualizarEstadoSensores({ pantallaActiva: true });
    }
  }

  async desactivarModoContinuo(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // Ignorar si ya fue liberado
      }
      this.wakeLockSentinel = null;
    }
    this._pantallaActiva.set(false);
    await this.auraData.actualizarEstadoSensores({ pantallaActiva: false });
  }

  async detenerTodo(): Promise<void> {
    await Promise.all([
      this.detenerGiroscopio(),
      this.detenerGPS(),
      this.desactivarModoContinuo(),
    ]);
  }

  // --- Controles de simulación para demostración en PC / clase ---

  async simularEventoGiroscopio(tipo: 'movimiento' | 'caida'): Promise<void> {
    this.prepararAudio();

    if (tipo === 'caida') {
      const lecturaSimulada: LecturaGiroscopio = {
        alpha: this.redondear(Math.random() * 360),
        beta: 84.5,
        gamma: -72.1,
        aceleracion: 31.4,
        rotacion: 285.0,
        fechaTexto: this.auraData.formatearFecha(new Date()),
      };
      this._lectura.set(lecturaSimulada);

      // Dispara directamente la Capa 2 ("¿Estás bien?" con cuenta regresiva, vibración y sonido)
      this.iniciarConfirmacionUsuario({
        inicioMs: Date.now(),
        picoAceleracion: 31.4,
        picoRotacion: 285.0,
        tuvoCaidaLibre: true,
        betaPre: 10,
        gammaPre: 5,
        muestrasMovimientoPost: 0,
        origen: 'Giroscopio (Simulación caída)',
        cambioAngulo: 74.5,
      });
      return;
    }

    // Simula un tropiezo / falsa alarma donde el paciente sigue en movimiento
    const lecturaSimulada: LecturaGiroscopio = {
      alpha: this.redondear(Math.random() * 360),
      beta: 24.3,
      gamma: 16.2,
      aceleracion: 21.8,
      rotacion: 165.0,
      fechaTexto: this.auraData.formatearFecha(new Date()),
    };
    this._lectura.set(lecturaSimulada);
    this._ultimoDiagnostico.set(
      'Falsa alarma simulada: golpe de 21.8 m/s² seguido de movimiento normal → descartada como caída.'
    );
  }

  async simularUbicacionGPS(): Promise<void> {
    const actual = this.auraData.ubicacion();
    const deltaLat = (Math.random() - 0.5) * 0.004;
    const deltaLng = (Math.random() - 0.5) * 0.004;

    await this.auraData.actualizarUbicacion(
      this.redondearCoord(actual.lat + deltaLat),
      this.redondearCoord(actual.lng + deltaLng),
      12,
      'simulada'
    );
    this._mensajeEstado.set('Ubicación simulada enviada al mapa del cuidador');
  }

  private redondear(val: number): number {
    return Math.round(val * 10) / 10;
  }

  private redondearCoord(val: number): number {
    return Math.round(val * 100000) / 100000;
  }
}
