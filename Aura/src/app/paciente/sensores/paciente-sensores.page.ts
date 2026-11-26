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
  cloudDoneOutline,
  cloudOfflineOutline,
  checkmarkCircleOutline,
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
      cloudDoneOutline,
      cloudOfflineOutline,
      checkmarkCircleOutline,
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

  async cerrarSesion() {
    await this.sensores.detenerTodo();
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
