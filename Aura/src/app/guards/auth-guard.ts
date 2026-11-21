import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export type UserRole = 'cuidador' | 'paciente';

export interface UserAccount {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
}

/**
 * Usuarios habilitados para la demostración de AURA.
 */
const VALID_USERS: UserAccount[] = [
  {
    username: 'cuidador',
    password: '123456',
    role: 'cuidador',
    displayName: 'Cuidador',
  },
  {
    username: 'paciente',
    password: '123456',
    role: 'paciente',
    displayName: 'Paciente',
  },
];

export function validateCredentials(
  username: string,
  password: string
): UserAccount | null {
  const normalized = username.trim().toLowerCase();
  return (
    VALID_USERS.find(
      (u) => u.username === normalized && u.password === password
    ) ?? null
  );
}

/** Protege rutas que requieren sesión iniciada */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureLoaded();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/** Protege rutas exclusivas de un rol ('cuidador' o 'paciente') */
export function roleGuard(expectedRole: UserRole): CanActivateFn {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.ensureLoaded();

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (authService.role() === expectedRole) {
      return true;
    }

    return router.createUrlTree([authService.getHomeRouteForRole()]);
  };
}

/** Evita volver a /login si el usuario ya tiene sesión activa */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureLoaded();

  if (authService.isAuthenticated()) {
    return router.createUrlTree([authService.getHomeRouteForRole()]);
  }

  return true;
};
