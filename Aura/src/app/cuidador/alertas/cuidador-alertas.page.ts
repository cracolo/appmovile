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
  checkmarkDoneOutline,
  refreshOutline,
  alertCircleOutline,
  warningOutline,
  hardwareChipOutline,
  calendarOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth';
import { AuraDataService } from '../../services/aura-data.service';

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
    private router: Router
  ) {
    addIcons({
      logOutOutline,
      checkmarkDoneOutline,
      refreshOutline,
      alertCircleOutline,
      warningOutline,
      hardwareChipOutline,
      calendarOutline,
    });
  }

  ionViewWillEnter() {
    void this.auraData.cargarDatosPersistidos();
  }

  async marcarLeidas() {
    await this.auraData.marcarTodasLeidas();
  }

  async restablecerDemo() {
    await this.auraData.restablecerAlertasDemo();
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
