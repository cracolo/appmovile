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
  arrowBackOutline,
  callOutline,
  medkitOutline,
  peopleOutline,
  alertCircleOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
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
export class Tab5Page {
  constructor(
    private router: Router,
    private toastController: ToastController,
    private authService: AuthService
  ) {
    addIcons({
      arrowBackOutline,
      callOutline,
      medkitOutline,
      peopleOutline,
      alertCircleOutline,
      logOutOutline,
    });
  }

  async llamarFamiliar() {
    const toast = await this.toastController.create({
      message: 'Llamando al familiar más cercano...',
      duration: 2500,
      position: 'bottom',
      color: 'primary',
      icon: 'call-outline',
    });
    await toast.present();
  }

  async llamarAmbulancia() {
    const toast = await this.toastController.create({
      message: 'Llamando a Ambulancia (131)...',
      duration: 2500,
      position: 'bottom',
      color: 'danger',
      icon: 'medkit-outline',
    });
    await toast.present();
  }

  volverPanel() {
    this.router.navigateByUrl('/tabs/tab2');
  }

  async cerrarSesion() {
    await this.authService.logout();
    await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }
}
