import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Credenciales válidas definidas aquí.
 */
const VALID_CREDENTIALS = {
  username: 'cristian',
  password: 'brevis',
};

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  return false;
};

/**
 * Valida credenciales contra el mock.
 * Exportada para que el AuthService la use.
 */
export function validateCredentials(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === VALID_CREDENTIALS.username &&
    password === VALID_CREDENTIALS.password
  );
}
