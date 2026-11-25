import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type TipoAlerta =
  | 'Caída'
  | 'Movimiento brusco'
  | 'Botón de Pánico'
  | 'Tropiezo';

export type SeveridadAlerta = 'critica' | 'media';

export interface RegistroAlerta {
  id: number;
  fechaISO: string;
  fechaTexto: string;
  origen: string;
  detalle: string;
  tipoAlerta: TipoAlerta;
  severidad: SeveridadAlerta;
  leida?: boolean;
}

export interface UbicacionPaciente {
  lat: number;
  lng: number;
  precisionMetros: number;
  fuente: 'gps' | 'simulada' | 'demo';
  fechaTexto: string;
  referencia: string;
}

export interface LecturaGiroscopio {
  alpha: number;
  beta: number;
  gamma: number;
  aceleracion: number;
  rotacion: number;
  fechaTexto: string;
}

export interface EstadoSensoresPaciente {
  giroscopioActivo: boolean;
  gpsActivo: boolean;
  pantallaActiva: boolean;
  ultimaLectura: LecturaGiroscopio | null;
}

const ALERTAS_KEY = 'aura_alertas_v1';
const UBICACION_KEY = 'aura_ubicacion_paciente_v1';
const SENSORES_KEY = 'aura_estado_sensores_v1';

const ALERTAS_INICIALES: RegistroAlerta[] = [
  {
    id: 1,
    fechaISO: '2026-11-20T18:45:00',
    fechaTexto: '20/11/2026 - 18:45 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Cambio brusco de inclinación seguido de inmovilidad breve.',
    tipoAlerta: 'Caída',
    severidad: 'critica',
    leida: false,
  },
  {
    id: 2,
    fechaISO: '2026-11-20T14:20:00',
    fechaTexto: '20/11/2026 - 14:20 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Rotación acelerada detectada mientras caminaba.',
    tipoAlerta: 'Movimiento brusco',
    severidad: 'media',
    leida: false,
  },
  {
    id: 3,
    fechaISO: '2026-11-19T22:10:00',
    fechaTexto: '19/11/2026 - 22:10 hrs',
    origen: 'Botón de Pánico',
    detalle: 'El paciente presionó asistencia rápida desde la app.',
    tipoAlerta: 'Botón de Pánico',
    severidad: 'critica',
    leida: true,
  },
  {
    id: 4,
    fechaISO: '2026-11-18T17:05:00',
    fechaTexto: '18/11/2026 - 17:05 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Sacudida moderada registrada por el sensor de movimiento.',
    tipoAlerta: 'Tropiezo',
    severidad: 'media',
    leida: true,
  },
];

const UBICACION_DEMO: UbicacionPaciente = {
  lat: -33.4489,
  lng: -70.6693,
  precisionMetros: 18,
  fuente: 'demo',
  fechaTexto: 'Ubicación de demostración (Santiago Centro)',
  referencia: 'Última posición registrada del paciente',
};

@Injectable({ providedIn: 'root' })
export class AuraDataService {
  private _alertas = signal<RegistroAlerta[]>(ALERTAS_INICIALES);
  private _ubicacion = signal<UbicacionPaciente>(UBICACION_DEMO);
  private _estadoSensores = signal<EstadoSensoresPaciente>({
    giroscopioActivo: false,
    gpsActivo: false,
    pantallaActiva: false,
    ultimaLectura: null,
  });

  readonly alertas = computed(() => this._alertas());
  readonly alertasSinLeer = computed(
    () => this._alertas().filter((a) => !a.leida).length
  );
  readonly ubicacion = computed(() => this._ubicacion());
  readonly estadoSensores = computed(() => this._estadoSensores());

  constructor() {
    this.cargarDatosPersistidos();
  }

  async cargarDatosPersistidos(): Promise<void> {
    const [{ value: alertasRaw }, { value: ubicacionRaw }, { value: sensoresRaw }] =
      await Promise.all([
        Preferences.get({ key: ALERTAS_KEY }),
        Preferences.get({ key: UBICACION_KEY }),
        Preferences.get({ key: SENSORES_KEY }),
      ]);

    if (alertasRaw) {
      try {
        const parsed = JSON.parse(alertasRaw) as RegistroAlerta[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._alertas.set(parsed);
        }
      } catch {
        // Mantiene alertas iniciales si el JSON está corrupto
      }
    }

    if (ubicacionRaw) {
      try {
        const parsed = JSON.parse(ubicacionRaw) as UbicacionPaciente;
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          this._ubicacion.set(parsed);
        }
      } catch {
        // Mantiene ubicación demo
      }
    }

    if (sensoresRaw) {
      try {
        const parsed = JSON.parse(sensoresRaw) as EstadoSensoresPaciente;
        this._estadoSensores.set(parsed);
      } catch {
        // Mantiene estado inicial
      }
    }
  }

  async registrarAlerta(params: {
    tipoAlerta: TipoAlerta;
    origen: string;
    detalle: string;
    severidad: SeveridadAlerta;
  }): Promise<RegistroAlerta> {
    const ahora = new Date();
    const nueva: RegistroAlerta = {
      id: Date.now(),
      fechaISO: ahora.toISOString(),
      fechaTexto: this.formatearFecha(ahora),
      origen: params.origen,
      detalle: params.detalle,
      tipoAlerta: params.tipoAlerta,
      severidad: params.severidad,
      leida: false,
    };

    const actualizadas = [nueva, ...this._alertas()];
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });

    return nueva;
  }

  async marcarTodasLeidas(): Promise<void> {
    const actualizadas = this._alertas().map((a) => ({ ...a, leida: true }));
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });
  }

  async restablecerAlertasDemo(): Promise<void> {
    this._alertas.set([...ALERTAS_INICIALES]);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(ALERTAS_INICIALES),
    });
  }

  async actualizarUbicacion(
    lat: number,
    lng: number,
    precisionMetros: number,
    fuente: 'gps' | 'simulada'
  ): Promise<void> {
    const nueva: UbicacionPaciente = {
      lat,
      lng,
      precisionMetros: Math.round(precisionMetros),
      fuente,
      fechaTexto: this.formatearFecha(new Date()),
      referencia:
        fuente === 'gps'
          ? 'GPS en vivo del celular del paciente'
          : 'Ubicación simulada para demostración',
    };

    this._ubicacion.set(nueva);
    await Preferences.set({
      key: UBICACION_KEY,
      value: JSON.stringify(nueva),
    });
  }

  async actualizarEstadoSensores(
    parcial: Partial<EstadoSensoresPaciente>
  ): Promise<void> {
    const siguiente: EstadoSensoresPaciente = {
      ...this._estadoSensores(),
      ...parcial,
    };
    this._estadoSensores.set(siguiente);
    await Preferences.set({
      key: SENSORES_KEY,
      value: JSON.stringify(siguiente),
    });
  }

  formatearFecha(fecha: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()} - ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())} hrs`;
  }
}
