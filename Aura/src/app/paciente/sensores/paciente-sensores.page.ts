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
  IonBadge,
  IonItem,
  IonLabel,
  IonToggle,
  IonText,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  playCircleOutline,
  stopCircleOutline,
  lockClosedOutline,
  locationOutline,
  pulseOutline,
  alertCircleOutline,
  navigateOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';
import { PacienteSensoresService } from '../../services/paciente-sensores.service';

@Component({
  selector: 'app-paciente-sensores',
  templateUrl: './paciente-sensores.page.html',
  styleUrls: ['./paciente-sensores.page.scss'],
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
    IonItem,
    IonLabel,
    IonToggle,
    IonText,
  ],
})
export class PacienteSensoresPage {
  constructor(
    private authService: AuthService,
    public auraData: AuraDataService,
    public sensores: PacienteSensoresService,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      shieldCheckmarkOutline,
      shieldOutline,
      playCircleOutline,
      stopCircleOutline,
      lockClosedOutline,
      locationOutline,
      pulseOutline,
      alertCircleOutline,
      navigateOutline,
    });
  }

  async toggleGiroscopio() {
    await this.sensores.alternarGiroscopio();
  }

  async toggleGPS() {
    await this.sensores.alternarGPS();
  }

  async toggleModoContinuo() {
    await this.sensores.alternarModoContinuo();
  }

  async simularMovimiento() {
    await this.sensores.simularEventoGiroscopio('movimiento');
    await this.mostrarToast(
      'Evento de movimiento brusco enviado a las alertas del cuidador.',
      'warning'
    );
  }

  async simularCaida() {
    await this.sensores.simularEventoGiroscopio('caida');
    await this.mostrarToast(
      '¡Alerta de caída enviada a la cuenta del cuidador!',
      'danger'
    );
  }

  async simularGPS() {
    await this.sensores.simularUbicacionGPS();
    await this.mostrarToast(
      'Nueva ubicación enviada al mapa del cuidador.',
      'primary'
    );
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async cerrarSesion() {
    await this.sensores.detenerTodo();
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
