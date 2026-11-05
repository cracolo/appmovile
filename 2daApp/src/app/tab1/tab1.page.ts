import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personOutline,
  keyOutline,
  eyeOutline,
  eyeOffOutline,
  lockClosedOutline,
  logInOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
  ],
})
export class Tab1Page implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({
      personOutline,
      keyOutline,
      eyeOutline,
      eyeOffOutline,
      lockClosedOutline,
      logInOutline,
    });
  }

  ngOnInit() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { username, password } = this.loginForm.value;
      await this.authService.login(username, password, true);
      this.loginForm.reset();
      await this.router.navigateByUrl('/tabs/tab2');
    } catch (error: any) {
      this.errorMessage = error?.message || 'Usuario o contraseña incorrectos';
    } finally {
      this.isLoading = false;
    }
  }
}
