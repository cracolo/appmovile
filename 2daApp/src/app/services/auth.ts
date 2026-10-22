import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { validateCredentials } from '../guards/auth.guard';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<string | null>(null);
  private _token = signal<string | null>(null);

  readonly user = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.loadSession();
  }

  /** Carga la sesión persistida al iniciar la app */
  private async loadSession() {
    const { value: token } = await Preferences.get({ key: TOKEN_KEY });
    const { value: user } = await Preferences.get({ key: USER_KEY });
    if (token && user) {
      this._token.set(token);
      this._user.set(user);
    }
  }

  /** Login: valida credenciales y persiste la sesión */
  async login(username: string, password: string, remember = true): Promise<void> {
    if (!validateCredentials(username, password)) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const fakeToken = btoa(`${username}:${Date.now()}`);

    this._token.set(fakeToken);
    this._user.set(username);

    if (remember) {
      await Preferences.set({ key: TOKEN_KEY, value: fakeToken });
      await Preferences.set({ key: USER_KEY, value: username });
    }
  }

  /** Cierra sesión y limpia almacenamiento */
  async logout(): Promise<void> {
    this._token.set(null);
    this._user.set(null);
    await Preferences.remove({ key: TOKEN_KEY });
    await Preferences.remove({ key: USER_KEY });
  }
}