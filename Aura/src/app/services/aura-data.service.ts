import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
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
  fuente: 'gps';
  fechaTexto: string;
  referencia: string;
}

export interface EstadoSensoresPaciente {
  giroscopioActivo: boolean;
  gpsActivo: boolean;
  pantallaActiva: boolean;
}

const ALERTAS_KEY = 'aura_alertas_v2';
const UBICACION_KEY = 'aura_ubicacion_paciente_v2';
const SENSORES_KEY = 'aura_estado_sensores_v2';

const COLECCION_ALERTAS = 'alertas';
const DOC_ESTADO_PACIENTE = 'principal';
const COLECCION_ESTADO = 'estado_paciente';

@Injectable({ providedIn: 'root' })
export class AuraDataService {
  private _alertas = signal<RegistroAlerta[]>([]);
  private _ubicacion = signal<UbicacionPaciente | null>(null);
  private _estadoSensores = signal<EstadoSensoresPaciente>({
    giroscopioActivo: false,
    gpsActivo: false,
    pantallaActiva: false,
  });
  private _nubeConectada = signal<boolean>(false);
  private _errorNube = signal<string>('');
  private _alertaCriticaActiva = signal<RegistroAlerta | null>(null);

  private listenersIniciados = false;
  private primeraCargaAlertas = true;
  private alertasDescartadasEnModal = new Set<number>();
  private audioCtx: AudioContext | null = null;

  readonly alertas = computed(() => this._alertas());
  readonly alertasSinLeer = computed(
    () => this._alertas().filter((a) => !a.leida).length
  );
  readonly ubicacion = computed(() => this._ubicacion());
  readonly estadoSensores = computed(() => this._estadoSensores());
  readonly nubeConectada = computed(() => this._nubeConectada());
  readonly errorNube = computed(() => this._errorNube());
  readonly alertaCriticaActiva = computed(() => this._alertaCriticaActiva());

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

        this.evaluarAlertaCriticaEntrante(lista);
        this.primeraCargaAlertas = false;
      },
      (error) => {
        this._nubeConectada.set(false);
        this._errorNube.set(
          `Sin conexión al servidor (${error.code || 'offline'}).`
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
          ubicacion?: UbicacionPaciente | null;
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
          `Sin conexión al servidor (${error.code || 'offline'}).`
        );
      }
    );
  }

  /** Detecta alertas críticas recientes sin leer para mostrar el aviso a pantalla completa al cuidador */
  private evaluarAlertaCriticaEntrante(lista: RegistroAlerta[]): void {
    const ahora = Date.now();
    const ventanaRecienteMs = 2 * 60 * 1000; // 2 minutos en primera carga

    const criticaPendiente = lista.find((a) => {
      if (a.severidad !== 'critica' || a.leida) return false;
      if (this.alertasDescartadasEnModal.has(a.id)) return false;

      if (this.primeraCargaAlertas) {
        const ts = a.createdAtMs ?? a.id;
        return ahora - ts <= ventanaRecienteMs;
      }
      return true;
    });

    const actual = this._alertaCriticaActiva();

    if (criticaPendiente) {
      if (!actual || actual.id !== criticaPendiente.id) {
        this._alertaCriticaActiva.set(criticaPendiente);
      }
    } else if (actual) {
      // Si se marcó como leída o se limpió desde otro dispositivo, cerrar el aviso
      const siguePendiente = lista.some(
        (a) => a.id === actual.id && !a.leida
      );
      if (!siguePendiente) {
        this._alertaCriticaActiva.set(null);
      }
    }
  }

  /** Sonido y vibración de aviso para el cuidador cuando aparece el overlay crítico */
  async notificarCuidadorAlertaCritica(): Promise<void> {
    try {
      await Haptics.vibrate({ duration: 500 });
    } catch {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Sin vibración en PC
      }
    }

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
        await this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.22,
        this.audioCtx.currentTime + 0.03
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + 0.45
      );
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.46);
    } catch {
      // Ignorar si el navegador bloquea autoplay de audio
    }
  }

  async cerrarAlertaCriticaActiva(marcarLeida = true): Promise<void> {
    const alerta = this._alertaCriticaActiva();
    if (!alerta) return;

    this.alertasDescartadasEnModal.add(alerta.id);
    this._alertaCriticaActiva.set(null);

    if (marcarLeida) {
      await this.marcarAlertaLeida(alerta);
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
        if (Array.isArray(parsed)) {
          this._alertas.set(parsed);
        }
      } catch {
        // Ignorar JSON inválido
      }
    }

    if (ubicacionRaw && !this._nubeConectada()) {
      try {
        const parsed = JSON.parse(ubicacionRaw) as UbicacionPaciente;
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          this._ubicacion.set(parsed);
        }
      } catch {
        // Ignorar JSON inválido
      }
    }

    if (sensoresRaw && !this._nubeConectada()) {
      try {
        const parsed = JSON.parse(sensoresRaw) as EstadoSensoresPaciente;
        this._estadoSensores.set(parsed);
      } catch {
        // Ignorar JSON inválido
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

    const actualizadas = [nueva, ...this._alertas()];
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });

    try {
      await setDoc(doc(firestoreDb, COLECCION_ALERTAS, docId), nueva);
    } catch {
      // Queda respaldada localmente si no hay red
    }

    return nueva;
  }

  async marcarAlertaLeida(alerta: RegistroAlerta): Promise<void> {
    if (alerta.leida) return;

    this.alertasDescartadasEnModal.add(alerta.id);
    if (this._alertaCriticaActiva()?.id === alerta.id) {
      this._alertaCriticaActiva.set(null);
    }

    const actualizadas = this._alertas().map((a) =>
      a.id === alerta.id ? { ...a, leida: true } : a
    );
    this._alertas.set(actualizadas);
    await Preferences.set({
      key: ALERTAS_KEY,
      value: JSON.stringify(actualizadas),
    });

    if (alerta.docId) {
      try {
        await updateDoc(doc(firestoreDb, COLECCION_ALERTAS, alerta.docId), {
          leida: true,
        });
      } catch {
        // Ignorar si está offline
      }
    }
  }

  async marcarTodasLeidas(): Promise<void> {
    const noLeidas = this._alertas().filter((a) => !a.leida);
    for (const a of noLeidas) {
      this.alertasDescartadasEnModal.add(a.id);
    }
    this._alertaCriticaActiva.set(null);

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

  /** Borra todas las alertas de Firestore y locales para limpiar el dashboard */
  async limpiarTodasLasAlertas(): Promise<void> {
    this._alertas.set([]);
    this._alertaCriticaActiva.set(null);
    this.alertasDescartadasEnModal.clear();
    await Preferences.remove({ key: ALERTAS_KEY });

    try {
      const snap = await getDocs(collection(firestoreDb, COLECCION_ALERTAS));
      if (!snap.empty) {
        const batch = writeBatch(firestoreDb);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {
      // Ignorar si está offline
    }
  }

  async actualizarUbicacion(
    lat: number,
    lng: number,
    precisionMetros: number
  ): Promise<void> {
    const nueva: UbicacionPaciente = {
      lat,
      lng,
      precisionMetros: Math.round(precisionMetros),
      fuente: 'gps',
      fechaTexto: this.formatearFecha(new Date()),
      referencia: 'GPS en vivo del celular del paciente',
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
