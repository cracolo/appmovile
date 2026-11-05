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
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  radioOutline,
  walkOutline,
  checkmarkCircleOutline,
  ellipseOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
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
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
  ],
})
export class Tab4Page {
  estadoSensorPresencia: 'activo' | 'pasivo' = 'activo';
  estadoRadar: 'activo' | 'pasivo' = 'activo';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    addIcons({
      arrowBackOutline,
      radioOutline,
      walkOutline,
      checkmarkCircleOutline,
      ellipseOutline,
      logOutOutline,
    });
  }

  cambiarSensorPresencia(modo: 'activo' | 'pasivo') {
    this.estadoSensorPresencia = modo;
  }

  cambiarEstadoRadar(modo: 'activo' | 'pasivo') {
    this.estadoRadar = modo;
  }

  volverPanel() {
    this.router.navigateByUrl('/tabs/tab2');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }
}
