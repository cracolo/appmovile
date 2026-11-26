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
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  checkmarkDoneOutline,
  checkmarkOutline,
  trashOutline,
  alertCircleOutline,
  warningOutline,
  hardwareChipOutline,
  calendarOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService, RegistroAlerta } from '../../services/aura-data.service';

@Component({
  selector: 'app-cuidador-alertas',
  templateUrl: './cuidador-alertas.page.html',
  styleUrls: ['./cuidador-alertas.page.scss'],
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
export class CuidadorAlertasPage {
  constructor(
    private authService: AuthService,
    public auraData: AuraDataService,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      checkmarkDoneOutline,
      checkmarkOutline,
      trashOutline,
      alertCircleOutline,
      warningOutline,
      hardwareChipOutline,
      calendarOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
      shieldCheckmarkOutline,
    });
  }

  ionViewWillEnter() {
    void this.auraData.cargarDatosPersistidos();
  }

  async marcarUnaLeida(alerta: RegistroAlerta) {
    await this.auraData.marcarAlertaLeida(alerta);
  }

  async marcarTodasLeidas() {
    await this.auraData.marcarTodasLeidas();
  }

  async confirmarLimpiarAlertas() {
    const alert = await this.alertController.create({
      header: 'Restablecer alertas',
      message:
        'Se eliminarán todas las alertas registradas para limpiar el dashboard. ¿Deseas continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Borrar todas',
          role: 'destructive',
          handler: () => {
            void this.limpiarAlertas();
          },
        },
      ],
    });
    await alert.present();
  }

  private async limpiarAlertas() {
    await this.auraData.limpiarTodasLasAlertas();
    const toast = await this.toastController.create({
      message: 'Dashboard de alertas limpiado.',
      duration: 2200,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
