import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { UserRole, validateCredentials } from '../guards/auth-guard';

const TOKEN_KEY = 'aura_auth_token';
const USER_KEY = 'aura_auth_user';
const ROLE_KEY = 'aura_auth_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<string | null>(null);
  private _token = signal<string | null>(null);
  private _role = signal<UserRole | null>(null);

  private readonly readyPromise: Promise<void>;

  readonly user = computed(() => this._user());
  readonly role = computed(() => this._role());
  readonly isAuthenticated = computed(() => !!this._token() && !!this._role());
  readonly isCuidador = computed(() => this._role() === 'cuidador');
  readonly isPaciente = computed(() => this._role() === 'paciente');

  constructor() {
    this.readyPromise = this.loadSession();
  }

  /** Espera a que termine la carga inicial de sesión desde Preferences */
  ensureLoaded(): Promise<void> {
    return this.readyPromise;
  }

  /** Carga la sesión persistida al iniciar la app */
  private async loadSession(): Promise<void> {
    const [{ value: token }, { value: user }, { value: role }] =
      await Promise.all([
        Preferences.get({ key: TOKEN_KEY }),
        Preferences.get({ key: USER_KEY }),
        Preferences.get({ key: ROLE_KEY }),
      ]);

    if (token && user && (role === 'cuidador' || role === 'paciente')) {
      this._token.set(token);
      this._user.set(user);
      this._role.set(role);
    }
  }

  /** Valida credenciales, guarda rol y persiste la sesión */
  async login(
    username: string,
    password: string,
    remember = true
  ): Promise<UserRole> {
    const account = validateCredentials(username, password);
    if (!account) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const fakeToken = btoa(`${account.username}:${account.role}:${Date.now()}`);

    this._token.set(fakeToken);
    this._user.set(account.username);
    this._role.set(account.role);

    if (remember) {
      await Promise.all([
        Preferences.set({ key: TOKEN_KEY, value: fakeToken }),
        Preferences.set({ key: USER_KEY, value: account.username }),
        Preferences.set({ key: ROLE_KEY, value: account.role }),
      ]);
    }

    return account.role;
  }

  /** Devuelve la ruta inicial correspondiente al rol autenticado */
  getHomeRouteForRole(role: UserRole | null = this._role()): string {
    if (role === 'paciente') {
      return '/tabs/paciente-sensores';
    }
    if (role === 'cuidador') {
      return '/tabs/cuidador-inicio';
    }
    return '/login';
  }

  /** Cierra sesión y limpia almacenamiento */
  async logout(): Promise<void> {
    this._token.set(null);
    this._user.set(null);
    this._role.set(null);
    await Promise.all([
      Preferences.remove({ key: TOKEN_KEY }),
      Preferences.remove({ key: USER_KEY }),
      Preferences.remove({ key: ROLE_KEY }),
    ]);
  }
}
