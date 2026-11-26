import { Injectable, signal, computed } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  Motion,
  AccelListenerEvent,
  OrientationListenerEvent,
} from '@capacitor/motion';
import { Geolocation } from '@capacitor/geolocation';
import { AuraDataService } from './aura-data.service';

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
}

@Injectable({ providedIn: 'root' })
export class PacienteSensoresService {
  private accelHandle: PluginListenerHandle | null = null;
  private orientationHandle: PluginListenerHandle | null = null;
  private geoWatchId: string | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  private inmovilidadTimer: ReturnType<typeof setTimeout> | null = null;
  private historialOrientacion: MuestraOrientacion[] = [];
  private ultimaOrientacion = { beta: 0, gamma: 0 };
  private ultimaCaidaLibreMs = 0;
  private ultimoEventoMs = 0;
  private candidatoActual: CandidatoCaida | null = null;

  // Parámetros de detección pasiva en 4 fases (impacto + postura + inmovilidad)
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

  private _giroscopioActivo = signal(false);
  private _gpsActivo = signal(false);
  private _pantallaActiva = signal(false);
  private _mensajeEstado = signal<string>('Protección en espera');
  private _errorSensor = signal<string>('');

  readonly giroscopioActivo = computed(() => this._giroscopioActivo());
  readonly gpsActivo = computed(() => this._gpsActivo());
  readonly pantallaActiva = computed(() => this._pantallaActiva());
  readonly mensajeEstado = computed(() => this._mensajeEstado());
  readonly errorSensor = computed(() => this._errorSensor());

  constructor(private auraData: AuraDataService) {}

  /** Activa o desactiva el detector pasivo de caídas */
  async alternarGiroscopio(): Promise<void> {
    if (this._giroscopioActivo()) {
      await this.detenerGiroscopio();
    } else {
      await this.iniciarGiroscopio();
    }
  }

  async iniciarGiroscopio(): Promise<void> {
    this._errorSensor.set('');

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
          const beta = this.redondear(event.beta ?? 0);
          const gamma = this.redondear(event.gamma ?? 0);
          const ahora = Date.now();

          this.ultimaOrientacion = { beta, gamma };
          this.historialOrientacion.push({ beta, gamma, ts: ahora });
          const limite = ahora - 2800;
          while (
            this.historialOrientacion.length > 0 &&
            this.historialOrientacion[0].ts < limite
          ) {
            this.historialOrientacion.shift();
          }
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

          this.evaluarMuestra(magnitud, picoRotacion);
        }
      );

      this._giroscopioActivo.set(true);
      this.actualizarMensajeGeneral();
      await this.auraData.actualizarEstadoSensores({
        giroscopioActivo: true,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar el sensor de movimiento';
      this._errorSensor.set(
        `No fue posible activar el detector de caídas (${msg}).`
      );
    }
  }

  async detenerGiroscopio(): Promise<void> {
    this.limpiarTimer();
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
    this.actualizarMensajeGeneral();
    await this.auraData.actualizarEstadoSensores({
      giroscopioActivo: false,
    });
  }

  // --- Detección pasiva en 4 fases (sin interrumpir al paciente) ---

  private evaluarMuestra(magnitud: number, picoRotacion: number): void {
    const ahora = Date.now();

    if (!this.candidatoActual) {
      // Fase 1: Caída libre breve (< 5.8 m/s²)
      if (magnitud <= this.UMBRAL_CAIDA_LIBRE_MS2) {
        this.ultimaCaidaLibreMs = ahora;
      }

      if (ahora - this.ultimoEventoMs < this.COOLDOWN_EVENTO_MS) {
        return;
      }

      // Fase 2: Impacto fuerte o impacto + rotación brusca
      const impactoFuerte =
        magnitud >= this.UMBRAL_IMPACTO_ACEL_MS2 ||
        (magnitud >= this.UMBRAL_IMPACTO_COMBINADO_ACEL &&
          picoRotacion >= this.UMBRAL_IMPACTO_COMBINADO_ROT) ||
        picoRotacion >= this.UMBRAL_IMPACTO_ROT_SOLA;

      if (impactoFuerte) {
        this.iniciarEvaluacionPostImpacto(magnitud, picoRotacion);
      }
      return;
    }

    // Fase 4: Evaluar quietud durante 3.5s tras el impacto
    const transcurrido = ahora - this.candidatoActual.inicioMs;

    if (transcurrido <= this.REBOTE_INICIAL_MS) {
      if (magnitud > this.candidatoActual.picoAceleracion) {
        this.candidatoActual.picoAceleracion = magnitud;
      }
      if (picoRotacion > this.candidatoActual.picoRotacion) {
        this.candidatoActual.picoRotacion = picoRotacion;
      }
      return;
    }

    const enMovimiento =
      magnitud > 14.5 || magnitud < 6.0 || picoRotacion > 90;

    if (enMovimiento) {
      this.candidatoActual.muestrasMovimientoPost += 1;
      if (this.candidatoActual.muestrasMovimientoPost >= 4) {
        void this.descartarPorMovimientoPosterior();
      }
    }
  }

  private iniciarEvaluacionPostImpacto(
    magnitud: number,
    picoRotacion: number
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
    };

    this.limpiarTimer();
    this.inmovilidadTimer = setTimeout(() => {
      void this.finalizarEvaluacionInmovilidad();
    }, this.VENTANA_INMOVILIDAD_MS);
  }

  private async descartarPorMovimientoPosterior(): Promise<void> {
    const candidato = this.candidatoActual;
    this.limpiarTimer();
    this.candidatoActual = null;
    this.ultimoEventoMs = Date.now();

    if (!candidato) return;

    // Si el golpe fue muy fuerte pero siguió moviéndose, avisar como Tropiezo leve
    if (candidato.picoAceleracion >= 26) {
      await this.auraData.registrarAlerta({
        tipoAlerta: 'Tropiezo',
        origen: 'Sensor de movimiento del paciente',
        detalle: `Aceleración ${candidato.picoAceleracion} m/s², giro ${candidato.picoRotacion}°/s. El paciente continuó moviéndose tras el golpe.`,
        severidad: 'media',
      });
    }
  }

  private async finalizarEvaluacionInmovilidad(): Promise<void> {
    const candidato = this.candidatoActual;
    this.limpiarTimer();
    this.candidatoActual = null;
    this.ultimoEventoMs = Date.now();

    if (!candidato) return;

    // Fase 3: Verificar cambio de postura (pre-impacto vs quietud post-impacto)
    const diffBeta = this.diferenciaAngular(
      candidato.betaPre,
      this.ultimaOrientacion.beta
    );
    const diffGamma = this.diferenciaAngular(
      candidato.gammaPre,
      this.ultimaOrientacion.gamma
    );
    const cambioAngulo = this.redondear(Math.max(diffBeta, diffGamma));

    const cumpleCriterioCaida =
      cambioAngulo >= this.UMBRAL_CAMBIO_ANGULO_DEG ||
      candidato.tuvoCaidaLibre ||
      candidato.picoAceleracion >= 28;

    if (!cumpleCriterioCaida) {
      return;
    }

    // Envío pasivo inmediato de la alerta crítica al cuidador (sin molestar al paciente)
    await this.auraData.registrarAlerta({
      tipoAlerta: 'Caída',
      origen: 'Detector automático de caídas',
      detalle: `Aceleración ${candidato.picoAceleracion} m/s², giro ${candidato.picoRotacion}°/s, cambio de postura ${cambioAngulo}°${candidato.tuvoCaidaLibre ? ', con caída libre previa' : ''} e inmovilidad posterior.`,
      severidad: 'critica',
    });
  }

  private obtenerOrientacionPrevia(ahora: number): {
    beta: number;
    gamma: number;
  } {
    const previas = this.historialOrientacion.filter(
      (m) => m.ts <= ahora - 500 && m.ts >= ahora - 2500
    );
    const fuente =
      previas.length > 0 ? previas : this.historialOrientacion.slice(0, 5);

    if (fuente.length === 0) {
      return { ...this.ultimaOrientacion };
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

  private limpiarTimer(): void {
    if (this.inmovilidadTimer) {
      clearTimeout(this.inmovilidadTimer);
      this.inmovilidadTimer = null;
    }
  }

  // --- Geolocalización real (solicita permiso + envío inmediato + seguimiento en vivo) ---

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
      // En Android/iOS nativo solicitar permisos explícitamente primero
      if (Capacitor.isNativePlatform()) {
        const perms = await Geolocation.requestPermissions();
        if (
          perms.location !== 'granted' &&
          perms.coarseLocation !== 'granted'
        ) {
          this._errorSensor.set(
            'Permiso de ubicación denegado. Habilítalo en los ajustes del teléfono.'
          );
          return;
        }
      }

      // 1. Obtener y enviar posición inicial de inmediato al mapa del cuidador
      try {
        const posInicial = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 5000,
        });
        await this.auraData.actualizarUbicacion(
          posInicial.coords.latitude,
          posInicial.coords.longitude,
          posInicial.coords.accuracy ?? 15
        );
      } catch {
        // Si tarda el primer fix, el watchPosition lo enviará apenas esté listo
      }

      // 2. Mantener seguimiento continuo en vivo
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        },
        (position, err) => {
          if (err) {
            this._errorSensor.set(
              'No se pudo actualizar la ubicación GPS. Verifica que el GPS esté encendido.'
            );
            return;
          }
          if (position) {
            this._errorSensor.set('');
            void this.auraData.actualizarUbicacion(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy ?? 15
            );
          }
        }
      );

      this.geoWatchId = id;
      this._gpsActivo.set(true);
      this.actualizarMensajeGeneral();
      await this.auraData.actualizarEstadoSensores({ gpsActivo: true });
    } catch {
      this._errorSensor.set(
        'No se pudo activar la ubicación. Verifica los permisos y el GPS del teléfono.'
      );
    }
  }

  async detenerGPS(): Promise<void> {
    if (this.geoWatchId !== null) {
      await Geolocation.clearWatch({ id: this.geoWatchId });
      this.geoWatchId = null;
    }
    this._gpsActivo.set(false);
    this.actualizarMensajeGeneral();
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
    } catch {
      // Ignorar si WakeLock no es soportado
    }
    this._pantallaActiva.set(true);
    await this.auraData.actualizarEstadoSensores({ pantallaActiva: true });
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

  private actualizarMensajeGeneral(): void {
    if (this._giroscopioActivo() && this._gpsActivo()) {
      this._mensajeEstado.set(
        'Detección de caídas y ubicación activas en silencio'
      );
    } else if (this._giroscopioActivo()) {
      this._mensajeEstado.set('Detección de caídas activa en segundo plano');
    } else if (this._gpsActivo()) {
      this._mensajeEstado.set('Compartiendo ubicación en vivo con tu cuidador');
    } else {
      this._mensajeEstado.set('Activa los sensores cuando necesites protección');
    }
  }

  private redondear(val: number): number {
    return Math.round(val * 10) / 10;
  }
}
