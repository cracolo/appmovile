import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  IonButton,
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
} from 'ionicons/icons';
import { AuthService } from '../services/auth';
import { AuraDataService } from '../services/aura-data.service';
import { PacienteSensoresService } from '../services/paciente-sensores.service';

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
  constructor(
    public authService: AuthService,
    public auraData: AuraDataService,
    public sensores: PacienteSensoresService
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
    });
  }

  estoyBien() {
    this.sensores.cancelarAlertaPaciente();
  }

  async necesitoAyuda() {
    await this.sensores.confirmarYEnviarCaida(true);
  }
}
