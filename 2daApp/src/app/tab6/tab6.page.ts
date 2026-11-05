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
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  informationCircleOutline,
  wifiOutline,
  notificationsOutline,
  shieldCheckmarkOutline,
  flashOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tab6',
  templateUrl: 'tab6.page.html',
  styleUrls: ['tab6.page.scss'],
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
  ],
})
export class Tab6Page {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    addIcons({
      arrowBackOutline,
      informationCircleOutline,
      wifiOutline,
      notificationsOutline,
      shieldCheckmarkOutline,
      flashOutline,
      logOutOutline,
    });
  }

  volverPanel() {
    this.router.navigateByUrl('/tabs/tab2');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }
}

