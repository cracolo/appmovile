import { Injectable, signal, computed } from '@angular/core';
import { PluginListenerHandle } from '@capacitor/core';
import { Motion, AccelListenerEvent, OrientationListenerEvent } from '@capacitor/motion';
import { Geolocation } from '@capacitor/geolocation';
import { AuraDataService, LecturaGiroscopio } from './aura-data.service';

@Injectable({ providedIn: 'root' })
export class PacienteSensoresService {
  private accelHandle: PluginListenerHandle | null = null;
  private orientationHandle: PluginListenerHandle | null = null;
  private geoWatchId: string | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  private ultimoEventoMs = 0;
  private readonly COOLDOWN_EVENTO_MS = 8000;
  private readonly UMBRAL_ROTACION_DEG_S = 180;
  private readonly UMBRAL_ACELERACION_MS2 = 22;

  private _giroscopioActivo = signal(false);
  private _gpsActivo = signal(false);
  private _pantallaActiva = signal(false);
  private _lectura = signal<LecturaGiroscopio>({
    alpha: 0,
    beta: 0,
    gamma: 0,
    aceleracion: 9.8,
    fechaTexto: 'Sin lecturas aún',
  });
  private _mensajeEstado = signal<string>('Sensores en espera');
  private _errorSensor = signal<string>('');
  private _eventosDetectadosSesion = signal<number>(0);

  readonly giroscopioActivo = computed(() => this._giroscopioActivo());
  readonly gpsActivo = computed(() => this._gpsActivo());
  readonly pantallaActiva = computed(() => this._pantallaActiva());
  readonly lectura = computed(() => this._lectura());
  readonly mensajeEstado = computed(() => this._mensajeEstado());
  readonly errorSensor = computed(() => this._errorSensor());
  readonly eventosDetectadosSesion = computed(() =>
    this._eventosDetectadosSesion()
  );

  constructor(private auraData: AuraDataService) {}

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

    try {
      // En iOS 13+ Safari / WebView requiere permiso explícito desde gesto de usuario
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
          const actual = this._lectura();
          this._lectura.set({
            alpha: this.redondear(event.alpha ?? 0),
            beta: this.redondear(event.beta ?? 0),
            gamma: this.redondear(event.gamma ?? 0),
            aceleracion: actual.aceleracion,
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
          const magnitud = this.redondear(Math.sqrt(ax * ax + ay * ay + az * az));

          const rotAlpha = Math.abs(event.rotationRate?.alpha ?? 0);
          const rotBeta = Math.abs(event.rotationRate?.beta ?? 0);
          const rotGamma = Math.abs(event.rotationRate?.gamma ?? 0);
          const picoRotacion = Math.max(rotAlpha, rotBeta, rotGamma);

          const actual = this._lectura();
          const nuevaLectura: LecturaGiroscopio = {
            alpha: actual.alpha,
            beta: actual.beta,
            gamma: actual.gamma,
            aceleracion: magnitud,
            fechaTexto: this.auraData.formatearFecha(new Date()),
          };
          this._lectura.set(nuevaLectura);

          if (
            picoRotacion >= this.UMBRAL_ROTACION_DEG_S ||
            magnitud >= this.UMBRAL_ACELERACION_MS2
          ) {
            this.procesarEventoDetectado(magnitud, picoRotacion);
          }
        }
      );

      this._giroscopioActivo.set(true);
      this._mensajeEstado.set(
        'Giroscopio activo y escuchando eventos de movimiento'
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
    if (this.accelHandle) {
      await this.accelHandle.remove();
      this.accelHandle = null;
    }
    if (this.orientationHandle) {
      await this.orientationHandle.remove();
      this.orientationHandle = null;
    }
    this._giroscopioActivo.set(false);
    this._mensajeEstado.set('Giroscopio detenido');
    await this.auraData.actualizarEstadoSensores({
      giroscopioActivo: false,
    });
  }

  private async procesarEventoDetectado(
    magnitud: number,
    picoRotacion: number
  ): Promise<void> {
    const ahora = Date.now();
    if (ahora - this.ultimoEventoMs < this.COOLDOWN_EVENTO_MS) {
      return;
    }
    this.ultimoEventoMs = ahora;
    this._eventosDetectadosSesion.update((v) => v + 1);

    const esCritica = magnitud >= 28 || picoRotacion >= 260;

    await this.auraData.registrarAlerta({
      tipoAlerta: esCritica ? 'Caída' : 'Movimiento brusco',
      origen: 'Giroscopio del paciente',
      detalle: `Pico detectado: aceleración ${magnitud} m/s², rotación ${this.redondear(picoRotacion)}°/s.`,
      severidad: esCritica ? 'critica' : 'media',
    });

    await this.auraData.actualizarEstadoSensores({
      ultimaLectura: this._lectura(),
    });
  }

  /** Activa o desactiva la geolocalización continua para el cuidador */
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

  /** Mantiene la sesión activa (Wake Lock API en web; base para Foreground Service en APK) */
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
        // Ignorar si ya fue liberado por el SO
      }
      this.wakeLockSentinel = null;
    }
    this._pantallaActiva.set(false);
    await this.auraData.actualizarEstadoSensores({ pantallaActiva: false });
  }

  /** Detiene todos los sensores (al cerrar sesión) */
  async detenerTodo(): Promise<void> {
    await Promise.all([
      this.detenerGiroscopio(),
      this.detenerGPS(),
      this.desactivarModoContinuo(),
    ]);
  }

  // --- Controles de simulación para demostración en PC / clase ---

  async simularEventoGiroscopio(tipo: 'movimiento' | 'caida'): Promise<void> {
    const esCaida = tipo === 'caida';
    const lecturaSimulada: LecturaGiroscopio = {
      alpha: this.redondear(Math.random() * 360),
      beta: this.redondear(esCaida ? 84.5 : 42.3),
      gamma: this.redondear(esCaida ? -72.1 : 28.6),
      aceleracion: esCaida ? 31.4 : 21.8,
      fechaTexto: this.auraData.formatearFecha(new Date()),
    };

    this._lectura.set(lecturaSimulada);
    this._eventosDetectadosSesion.update((v) => v + 1);

    await this.auraData.registrarAlerta({
      tipoAlerta: esCaida ? 'Caída' : 'Movimiento brusco',
      origen: 'Giroscopio (Simulación demo)',
      detalle: esCaida
        ? 'Impacto fuerte e inclinación horizontal simulada (31.4 m/s²).'
        : 'Cambio rápido de orientación simulado en el eje beta/gamma.',
      severidad: esCaida ? 'critica' : 'media',
    });

    await this.auraData.actualizarEstadoSensores({
      ultimaLectura: lecturaSimulada,
    });
  }

  async simularUbicacionGPS(): Promise<void> {
    const actual = this.auraData.ubicacion();
    // Pequeño desplazamiento realista (~100-300m alrededor de la ubicación actual)
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
