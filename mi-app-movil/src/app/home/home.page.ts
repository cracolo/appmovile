import { Component, OnInit, inject } from '@angular/core';
import {
  IonCol,
  IonContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonHeader,
  IonIcon,
  IonImg,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { camera } from 'ionicons/icons';
import { PhotoService } from '../services/photo.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonImg,
  ],
})
export class HomePage implements OnInit {
  public readonly photoService = inject(PhotoService);

  constructor() {
    addIcons({ camera });
  }

  async ngOnInit(): Promise<void> {
    await this.photoService.loadSaved();
  }

  async addPhotoToGallery(): Promise<void> {
    try {
      await this.photoService.addNewToGallery();
    } catch (error) {
      // El usuario cerró la cámara sin tomar una foto o denegó el permiso
      console.warn('No se pudo capturar la foto:', error);
    }
  }
}
