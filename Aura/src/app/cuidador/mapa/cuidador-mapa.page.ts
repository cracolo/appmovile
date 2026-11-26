import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  navigateOutline,
  radioOutline,
  timeOutline,
  mapOutline,
  locateOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';

const DEFAULT_CENTER: L.LatLngTuple = [-33.4489, -70.6693];

@Component({
  selector: 'app-cuidador-mapa',
  templateUrl: './cuidador-mapa.page.html',
  styleUrls: ['./cuidador-mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonBadge,
  ],
})
export class CuidadorMapaPage implements OnDestroy {
  @ViewChild('mapContainer', { static: false })
  mapContainer?: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private accuracyCircle: L.Circle | null = null;

  constructor(
    private authService: AuthService,
    public auraData: AuraDataService,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      navigateOutline,
      radioOutline,
      timeOutline,
      mapOutline,
      locateOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
    });

    // Reacciona automáticamente a cada actualización GPS recibida desde Firebase
    effect(() => {
      const ubicacion = this.auraData.ubicacion();
      if (ubicacion) {
        this.actualizarMarcador(
          ubicacion.lat,
          ubicacion.lng,
          ubicacion.precisionMetros
        );
      }
    });
  }

  ionViewDidEnter() {
    void this.auraData.cargarDatosPersistidos().then(() => {
      this.inicializarMapa();
      setTimeout(() => this.map?.invalidateSize(), 150);
    });
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private inicializarMapa() {
    if (!this.mapContainer) {
      return;
    }

    const ub = this.auraData.ubicacion();
    const centro: L.LatLngTuple = ub ? [ub.lat, ub.lng] : DEFAULT_CENTER;
    const zoomInicial = ub ? 16 : 12;

    if (!this.map) {
      this.map = L.map(this.mapContainer.nativeElement, {
        center: centro,
        zoom: zoomInicial,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(this.map);
    }

    if (ub) {
      this.actualizarMarcador(ub.lat, ub.lng, ub.precisionMetros);
    }
  }

  private actualizarMarcador(
    lat: number,
    lng: number,
    precisionMetros: number
  ) {
    if (!this.map) {
      return;
    }

    const coords: L.LatLngExpression = [lat, lng];

    if (!this.marker) {
      const patientIcon = L.divIcon({
        className: 'aura-patient-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      this.marker = L.marker(coords, { icon: patientIcon })
        .addTo(this.map)
        .bindPopup('<strong>Paciente AURA</strong><br>Ubicación en vivo')
        .openPopup();
    } else {
      this.marker.setLatLng(coords);
    }

    if (!this.accuracyCircle) {
      this.accuracyCircle = L.circle(coords, {
        radius: Math.max(precisionMetros, 15),
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.2,
      }).addTo(this.map);
    } else {
      this.accuracyCircle.setLatLng(coords);
      this.accuracyCircle.setRadius(Math.max(precisionMetros, 15));
    }

    this.map.setView(coords, Math.max(this.map.getZoom(), 16));
  }

  centrarEnPaciente() {
    const ub = this.auraData.ubicacion();
    if (ub) {
      this.actualizarMarcador(ub.lat, ub.lng, ub.precisionMetros);
    }
    this.map?.invalidateSize();
  }

  abrirEnGoogleMaps() {
    const ub = this.auraData.ubicacion();
    if (!ub) return;
    const url = `https://www.google.com/maps?q=${ub.lat},${ub.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
