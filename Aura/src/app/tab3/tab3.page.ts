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
  arrowBackOutline,
  calendarOutline,
  locationOutline,
  warningOutline,
  alertCircleOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

export interface RegistroAlerta {
  id: number;
  fechaISO: string;
  fechaTexto: string;
  lugar: 'Dormitorio' | 'Cocina' | 'Baño' | 'Living' | 'Comedor';
  tipoAlerta: 'Caída' | 'Tropiezo';
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
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
export class Tab3Page {
  // Datos inventados ordenados por fecha (del más reciente al más antiguo)
  historialAlertas: RegistroAlerta[] = ([
    {
      id: 1,
      fechaISO: '2026-11-04T19:45:00',
      fechaTexto: '04/11/2026 - 19:45 hrs',
      lugar: 'Baño',
      tipoAlerta: 'Caída',
    },
    {
      id: 2,
      fechaISO: '2026-11-03T14:20:00',
      fechaTexto: '03/11/2026 - 14:20 hrs',
      lugar: 'Cocina',
      tipoAlerta: 'Tropiezo',
    },
    {
      id: 3,
      fechaISO: '2026-11-01T22:10:00',
      fechaTexto: '01/11/2026 - 22:10 hrs',
      lugar: 'Dormitorio',
      tipoAlerta: 'Caída',
    },
    {
      id: 4,
      fechaISO: '2026-10-29T17:05:00',
      fechaTexto: '29/10/2026 - 17:05 hrs',
      lugar: 'Living',
      tipoAlerta: 'Tropiezo',
    },
    {
      id: 5,
      fechaISO: '2026-10-25T13:30:00',
      fechaTexto: '25/10/2026 - 13:30 hrs',
      lugar: 'Comedor',
      tipoAlerta: 'Tropiezo',
    },
    {
      id: 6,
      fechaISO: '2026-10-20T08:15:00',
      fechaTexto: '20/10/2026 - 08:15 hrs',
      lugar: 'Dormitorio',
      tipoAlerta: 'Caída',
    },
  ] satisfies RegistroAlerta[]).sort(
    (a, b) => new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime()
  );

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    addIcons({
      arrowBackOutline,
      calendarOutline,
      locationOutline,
      warningOutline,
      alertCircleOutline,
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
