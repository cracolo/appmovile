import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  logInOutline,
  shieldCheckmarkOutline,
  heartOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';
import { UserRole } from '../guards/auth-guard';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
export class LoginPage {
  readonly loginForm = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({
      personOutline,
      keyOutline,
      eyeOutline,
      eyeOffOutline,
      logInOutline,
      shieldCheckmarkOutline,
      heartOutline,
    });
  }

  get usernameControl(): FormControl<string> {
    return this.loginForm.controls.username;
  }

  get passwordControl(): FormControl<string> {
    return this.loginForm.controls.password;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  rellenarDemo(rol: UserRole) {
    this.errorMessage = '';
    this.loginForm.setValue({
      username: rol,
      password: '123456',
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { username, password } = this.loginForm.getRawValue();
      const role = await this.authService.login(username, password, true);
      this.loginForm.reset();
      await this.router.navigateByUrl(
        this.authService.getHomeRouteForRole(role),
        { replaceUrl: true }
      );
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Usuario o contraseña incorrectos';
    } finally {
      this.isLoading = false;
    }
  }
}
