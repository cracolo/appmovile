import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  shieldCheckmarkOutline,
  notificationsOutline,
  mapOutline,
  callOutline,
  hardwareChipOutline,
  alertCircleOutline,
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
  ],
})
export class TabsPage {
  constructor(
    public authService: AuthService,
    public auraData: AuraDataService
  ) {
    addIcons({
      shieldCheckmarkOutline,
      notificationsOutline,
      mapOutline,
      callOutline,
      hardwareChipOutline,
      alertCircleOutline,
    });
  }
}
