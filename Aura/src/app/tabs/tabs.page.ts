import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  IonButton,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  shieldCheckmarkOutline,
  notificationsOutline,
  mapOutline,
  callOutline,
  hardwareChipOutline,
  alertCircleOutline,
  warningOutline,
  checkmarkCircleOutline,
  medkitOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';
import { AuraDataService } from '../services/aura-data.service';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge,
    IonButton,
  ],
})
export class TabsPage {
  private ultimoIdNotificado: number | null = null;

  constructor(
    public authService: AuthService,
    public auraData: AuraDataService,
    private router: Router,
    private toastController: ToastController
  ) {
    addIcons({
      shieldCheckmarkOutline,
      notificationsOutline,
      mapOutline,
      callOutline,
      hardwareChipOutline,
      alertCircleOutline,
      warningOutline,
      checkmarkCircleOutline,
      medkitOutline,
    });

    // Vibrar y emitir aviso sonoro cuando llega una nueva alerta crítica al cuidador
    effect(() => {
      const esCuidador = this.authService.isCuidador();
      const alerta = this.auraData.alertaCriticaActiva();
      if (esCuidador && alerta && alerta.id !== this.ultimoIdNotificado) {
        this.ultimoIdNotificado = alerta.id;
        void this.auraData.notificarCuidadorAlertaCritica();
      }
    });
  }

  async llamarPaciente() {
    await this.mostrarToast('Llamando al Paciente (+56912345678)...', 'primary');
    window.location.href = 'tel:+56912345678';
  }

  async llamarEmergencias() {
    await this.mostrarToast('Llamando a Emergencias (131)...', 'danger');
    window.location.href = 'tel:131';
  }

  async verEnMapa() {
    await this.auraData.cerrarAlertaCriticaActiva(true);
    await this.router.navigateByUrl('/tabs/cuidador-mapa');
  }

  async marcarLeidaYCerrar() {
    await this.auraData.cerrarAlertaCriticaActiva(true);
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
