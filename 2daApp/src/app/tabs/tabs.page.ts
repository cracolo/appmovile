import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  shieldCheckmarkOutline,
  informationCircleOutline,
  notificationsOutline,
  hardwareChipOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  constructor(public authService: AuthService) {
    addIcons({
      homeOutline,
      shieldCheckmarkOutline,
      informationCircleOutline,
      notificationsOutline,
      hardwareChipOutline,
      alertCircleOutline,
    });
  }
}
