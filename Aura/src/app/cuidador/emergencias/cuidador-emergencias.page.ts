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
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  personCircleOutline,
  callOutline,
  alertCircleOutline,
  medkitOutline,
  shieldOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-cuidador-emergencias',
  templateUrl: './cuidador-emergencias.page.html',
  styleUrls: ['./cuidador-emergencias.page.scss'],
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
  ],
})
export class CuidadorEmergenciasPage {
  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      personCircleOutline,
      callOutline,
      alertCircleOutline,
      medkitOutline,
      shieldOutline,
    });
  }

  async llamar(destinatario: string, numero: string) {
    const toast = await this.toastController.create({
      message: `Iniciando llamada a ${destinatario} (${numero})...`,
      duration: 2800,
      position: 'bottom',
      color: numero === '131' ? 'danger' : 'primary',
      icon: 'call-outline',
    });
    await toast.present();

    // En teléfonos reales abre el marcador nativo
    window.location.href = `tel:${numero}`;
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
