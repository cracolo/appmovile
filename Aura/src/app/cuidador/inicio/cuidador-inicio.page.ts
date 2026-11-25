import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  hardwareChipOutline,
  mapOutline,
  callOutline,
  notificationsOutline,
  locationOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';

@Component({
  selector: 'app-cuidador-inicio',
  templateUrl: './cuidador-inicio.page.html',
  styleUrls: ['./cuidador-inicio.page.scss'],
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
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
  ],
})
export class CuidadorInicioPage {
  constructor(
    private authService: AuthService,
    public auraData: AuraDataService,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      hardwareChipOutline,
      mapOutline,
      callOutline,
      notificationsOutline,
      locationOutline,
    });
  }

  ionViewWillEnter() {
    void this.auraData.cargarDatosPersistidos();
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
