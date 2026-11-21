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
  alertCircleOutline,
  peopleOutline,
  medkitOutline,
  callOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';
import { PacienteSensoresService } from '../../services/paciente-sensores.service';

@Component({
  selector: 'app-paciente-panico',
  templateUrl: './paciente-panico.page.html',
  styleUrls: ['./paciente-panico.page.scss'],
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
export class PacientePanicoPage {
  ultimaAlertaEnviada = '';

  constructor(
    private authService: AuthService,
    private auraData: AuraDataService,
    private sensores: PacienteSensoresService,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      alertCircleOutline,
      peopleOutline,
      medkitOutline,
      callOutline,
    });
  }

  async activarPanico() {
    const alerta = await this.auraData.registrarAlerta({
      tipoAlerta: 'Botón de Pánico',
      origen: 'Botón SOS del paciente',
      detalle: 'El paciente solicitó ayuda urgente presionando el botón de pánico.',
      severidad: 'critica',
    });

    this.ultimaAlertaEnviada = alerta.fechaTexto;

    const toast = await this.toastController.create({
      message: '¡Alerta SOS enviada al cuidador!',
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      icon: 'alert-circle-outline',
    });
    await toast.present();
  }

  async llamar(destinatario: string, numero: string) {
    const toast = await this.toastController.create({
      message: `Llamando a ${destinatario} (${numero})...`,
      duration: 2800,
      position: 'bottom',
      color: numero === '131' ? 'danger' : 'primary',
      icon: 'call-outline',
    });
    await toast.present();

    window.location.href = `tel:${numero}`;
  }

  async cerrarSesion() {
    await this.sensores.detenerTodo();
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
