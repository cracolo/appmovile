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
} from 'ionicons/icons';

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
  constructor(private router: Router) {
    addIcons({
      arrowBackOutline,
      informationCircleOutline,
      wifiOutline,
      notificationsOutline,
      shieldCheckmarkOutline,
      flashOutline,
    });
  }

  volverPanel() {
    this.router.navigateByUrl('/tabs/tab2');
  }
}

