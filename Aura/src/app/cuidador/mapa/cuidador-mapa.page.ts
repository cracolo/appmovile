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
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';

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
    });

    effect(() => {
      const ubicacion = this.auraData.ubicacion();
      this.actualizarMarcador(
        ubicacion.lat,
        ubicacion.lng,
        ubicacion.precisionMetros
      );
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

    const { lat, lng, precisionMetros } = this.auraData.ubicacion();

    if (!this.map) {
      this.map = L.map(this.mapContainer.nativeElement, {
        center: [lat, lng],
        zoom: 16,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(this.map);

      const patientIcon = L.divIcon({
        className: 'aura-patient-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      this.marker = L.marker([lat, lng], { icon: patientIcon })
        .addTo(this.map)
        .bindPopup('<strong>Paciente AURA</strong><br>Ubicación actual')
        .openPopup();

      this.accuracyCircle = L.circle([lat, lng], {
        radius: Math.max(precisionMetros, 15),
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.2,
      }).addTo(this.map);
    } else {
      this.actualizarMarcador(lat, lng, precisionMetros);
    }
  }

  private actualizarMarcador(
    lat: number,
    lng: number,
    precisionMetros: number
  ) {
    if (!this.map || !this.marker || !this.accuracyCircle) {
      return;
    }
    const coords: L.LatLngExpression = [lat, lng];
    this.marker.setLatLng(coords);
    this.accuracyCircle.setLatLng(coords);
    this.accuracyCircle.setRadius(Math.max(precisionMetros, 15));
    this.map.setView(coords, this.map.getZoom());
  }

  async centrarEnPaciente() {
    await this.auraData.cargarDatosPersistidos();
    const { lat, lng, precisionMetros } = this.auraData.ubicacion();
    this.actualizarMarcador(lat, lng, precisionMetros);
    this.map?.invalidateSize();
  }

  abrirEnGoogleMaps() {
    const { lat, lng } = this.auraData.ubicacion();
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
