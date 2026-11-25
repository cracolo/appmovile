import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';

export type TipoAlerta =
  | 'Caída'
  | 'Movimiento brusco'
  | 'Botón de Pánico'
  | 'Tropiezo';

export type SeveridadAlerta = 'critica' | 'media';

export interface RegistroAlerta {
  id: number;
  docId?: string;
  fechaISO: string;
  fechaTexto: string;
  origen: string;
  detalle: string;
  tipoAlerta: TipoAlerta;
  severidad: SeveridadAlerta;
  leida?: boolean;
  createdAtMs?: number;
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

const COLECCION_ALERTAS = 'alertas';
const DOC_ESTADO_PACIENTE = 'principal';
const COLECCION_ESTADO = 'estado_paciente';

const ALERTAS_INICIALES: RegistroAlerta[] = [
  {
    id: 1,
    docId: 'demo-1',
    fechaISO: '2026-11-20T18:45:00',
    fechaTexto: '20/11/2026 - 18:45 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Cambio brusco de inclinación seguido de inmovilidad breve.',
    tipoAlerta: 'Caída',
    severidad: 'critica',
    leida: false,
    createdAtMs: 1795124700000,
  },
  {
    id: 2,
    docId: 'demo-2',
    fechaISO: '2026-11-20T14:20:00',
    fechaTexto: '20/11/2026 - 14:20 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Rotación acelerada detectada mientras caminaba.',
    tipoAlerta: 'Movimiento brusco',
    severidad: 'media',
    leida: false,
    createdAtMs: 1795108800000,
  },
  {
    id: 3,
    docId: 'demo-3',
    fechaISO: '2026-11-19T22:10:00',
    fechaTexto: '19/11/2026 - 22:10 hrs',
    origen: 'Botón de Pánico',
    detalle: 'El paciente presionó asistencia rápida desde la app.',
    tipoAlerta: 'Botón de Pánico',
    severidad: 'critica',
    leida: true,
    createdAtMs: 1795050600000,
  },
  {
    id: 4,
    docId: 'demo-4',
    fechaISO: '2026-11-18T17:05:00',
    fechaTexto: '18/11/2026 - 17:05 hrs',
    origen: 'Giroscopio del celular',
    detalle: 'Sacudida moderada registrada por el sensor de movimiento.',
    tipoAlerta: 'Tropiezo',
    severidad: 'media',
    leida: true,
    createdAtMs: 1794945900000,
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
  private _nubeConectada = signal<boolean>(false);
  private _errorNube = signal<string>('');

  private listenersIniciados = false;

  readonly alertas = computed(() => this._alertas());
  readonly alertasSinLeer = computed(
    () => this._alertas().filter((a) => !a.leida).length
  );
  readonly ubicacion = computed(() => this._ubicacion());
  readonly estadoSensores = computed(() => this._estadoSensores());
  readonly nubeConectada = computed(() => this._nubeConectada());
  readonly errorNube = computed(() => this._errorNube());

  constructor() {
    void this.cargarDatosPersistidos();
    this.iniciarSincronizacionTiempoReal();
  }

  /** Suscripción en tiempo real a Firestore (alertas + ubicación + sensores) */
  private iniciarSincronizacionTiempoReal(): void {
    if (this.listenersIniciados) return;
    this.listenersIniciados = true;

    // 1. Escuchar alertas en tiempo real
    const qAlertas = query(
      collection(firestoreDb, COLECCION_ALERTAS),
      orderBy('createdAtMs', 'desc'),
      limit(50)
    );

    onSnapshot(
      qAlertas,
      (snapshot) => {
        this._nubeConectada.set(true);
        this._errorNube.set('');

        if (snapshot.empty) {
          // Si la colección en Firestore está vacía por primera vez, sembramos las 4 alertas demo
          void this.sembrarAlertasDemoEnNube();
          return;
        }

        const lista: RegistroAlerta[] = snapshot.docs.map((d) => {
          const data = d.data() as RegistroAlerta;
          return {
            ...data,
            docId: d.id,
          };
        });

        this._alertas.set(lista);
        void Preferences.set({
          key: ALERTAS_KEY,
          value: JSON.stringify(lista),
        });
      },
      (error) => {
        this._nubeConectada.set(false);
        this._errorNube.set(
          `Sin conexión a Firestore (${error.code || 'offline'}). Usando respaldo local.`
        );
      }
    );

    // 2. Escuchar ubicación y estado de sensores del paciente en tiempo real
    const refEstado = doc(firestoreDb, COLECCION_ESTADO, DOC_ESTADO_PACIENTE);
    onSnapshot(
      refEstado,
      (snap) => {
        this._nubeConectada.set(true);
        this._errorNube.set('');

        if (!snap.exists()) return;

        const data = snap.data() as {
          ubicacion?: UbicacionPaciente;
          sensores?: EstadoSensoresPaciente;
        };

        if (
          data.ubicacion &&
          typeof data.ubicacion.lat === 'number' &&
          typeof data.ubicacion.lng === 'number'
        ) {
          this._ubicacion.set(data.ubicacion);
          void Preferences.set({
            key: UBICACION_KEY,
            value: JSON.stringify(data.ubicacion),
          });
        }

        if (data.sensores) {
          this._estadoSensores.set(data.sensores);
          void Preferences.set({
            key: SENSORES_KEY,
            value: JSON.stringify(data.sensores),
          });
        }
      },
      (error) => {
        this._nubeConectada.set(false);
        this._errorNube.set(
          `Sin conexión a Firestore (${error.code || 'offline'}). Usando respaldo local.`
        );
      }
    );
  }

  private async sembrarAlertasDemoEnNube(): Promise<void> {
    try {
      const batch = writeBatch(firestoreDb);
      for (const alerta of ALERTAS_INICIALES) {
        const docId = alerta.docId ?? `demo-${alerta.id}`;
        batch.set(doc(firestoreDb, COLECCION_ALERTAS, docId), alerta);
      }
      await batch.commit();
    } catch {
      // Si no hay conexión aún, mantiene las locales
    }
  }

  async cargarDatosPersistidos(): Promise<void> {
    const [
      { value: alertasRaw },
      { value: ubicacionRaw },
      { value: sensoresRaw },
    ] = await Promise.all([
      Preferences.get({ key: ALERTAS_KEY }),
      Preferences.get({ key: UBICACION_KEY }),
      Preferences.get({ key: SENSORES_KEY }),
    ]);

    if (alertasRaw && !this._nubeConectada()) {
      try {
        const parsed = JSON.parse(alertasRaw) as RegistroAlerta[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._alertas.set(parsed);
        }
      } catch {
        // Mantiene alertas iniciales
      }
    }

    if (ubicacionRaw && !this._nubeConectada()) {
      try {
        const parsed = JSON.parse(ubicacionRaw) as UbicacionPaciente;
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          this._ubicacion.set(parsed);
        }
      } catch {
        // Mantiene ubicación demo
      }
    }

    if (sensoresRaw && !this._nubeConectada()) {
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
    const nowMs = ahora.getTime();
    const docId = `alerta-${nowMs}`;

    const nueva: RegistroAlerta = {
      id: nowMs,
      docId,
      fechaISO: ahora.toISOString(),
      fechaTexto: this.formatearFecha(ahora),
      origen: params.origen,
      detalle: params.detalle,
      tipoAlerta: params.tipoAlerta,
      severidad: params.severidad,
      leida: false,
      createdAtMs: nowMs,
    };

    // Actualización local inmediata
    const actualizadas = [nueva, ...this._alertas()];
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });

    // Publicar en Firestore para el cuidador en tiempo real
    try {
      await setDoc(doc(firestoreDb, COLECCION_ALERTAS, docId), nueva);
    } catch {
      // Queda respaldada localmente si no hay red
    }

    return nueva;
  }

  async marcarTodasLeidas(): Promise<void> {
    const noLeidas = this._alertas().filter((a) => !a.leida);
    const actualizadas = this._alertas().map((a) => ({ ...a, leida: true }));
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });

    try {
      await Promise.all(
        noLeidas
          .filter((a) => !!a.docId)
          .map((a) =>
            updateDoc(doc(firestoreDb, COLECCION_ALERTAS, a.docId!), {
              leida: true,
            })
          )
      );
    } catch {
      // Ignorar si está offline
    }
  }

  async restablecerAlertasDemo(): Promise<void> {
    this._alertas.set([...ALERTAS_INICIALES]);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(ALERTAS_INICIALES),
    });

    try {
      const snap = await getDocs(collection(firestoreDb, COLECCION_ALERTAS));
      const batch = writeBatch(firestoreDb);
      snap.forEach((d) => batch.delete(d.ref));
      for (const alerta of ALERTAS_INICIALES) {
        const docId = alerta.docId ?? `demo-${alerta.id}`;
        batch.set(doc(firestoreDb, COLECCION_ALERTAS, docId), alerta);
      }
      await batch.commit();
    } catch {
      // Ignorar si está offline
    }
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

    try {
      await setDoc(
        doc(firestoreDb, COLECCION_ESTADO, DOC_ESTADO_PACIENTE),
        {
          ubicacion: nueva,
          updatedAtMs: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // Queda respaldada localmente
    }
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

    try {
      await setDoc(
        doc(firestoreDb, COLECCION_ESTADO, DOC_ESTADO_PACIENTE),
        {
          sensores: siguiente,
          updatedAtMs: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // Queda respaldada localmente
    }
  }

  formatearFecha(fecha: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()} - ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())} hrs`;
  }
}
