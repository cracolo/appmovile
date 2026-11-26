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
  logOutOutline,
  alertCircleOutline,
  warningOutline,
  calendarOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';
import { PacienteSensoresService } from '../../services/paciente-sensores.service';

@Component({
  selector: 'app-paciente-alertas',
  templateUrl: './paciente-alertas.page.html',
  styleUrls: ['./paciente-alertas.page.scss'],
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
export class PacienteAlertasPage {
  constructor(
    private authService: AuthService,
    public auraData: AuraDataService,
    public sensores: PacienteSensoresService,
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      alertCircleOutline,
      warningOutline,
      calendarOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
      shieldCheckmarkOutline,
    });
  }

  ionViewWillEnter() {
    void this.auraData.cargarDatosPersistidos();
  }

  async cerrarSesion() {
    await this.sensores.detenerTodo();
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
