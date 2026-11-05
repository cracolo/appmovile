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
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  notificationsOutline,
  hardwareChipOutline,
  alertCircleOutline,
  logOutOutline,
  optionsOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
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
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
  ],
})
export class Tab2Page {
  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {
    addIcons({
      settingsOutline,
      notificationsOutline,
      hardwareChipOutline,
      alertCircleOutline,
      logOutOutline,
      optionsOutline,
    });
  }

  async mostrarMensaje(mensaje: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  verHistorialAlertas() {
    this.router.navigateByUrl('/tabs/tab3');
  }

  verEstadoSensores() {
    this.router.navigateByUrl('/tabs/tab4');
  }

  pedirAyuda() {
    this.router.navigateByUrl('/tabs/tab5');
  }

  abrirConfiguracion() {
    this.mostrarMensaje('Abriendo Configuración...', 'medium');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }
}
