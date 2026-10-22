import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Credenciales válidas definidas aquí (mock local).
 * En producción esto vendría del backend.
 */
const VALID_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigateByUrl('/login', { replaceUrl: true });
  return false;
};

/**
 * Valida credenciales contra el mock.
 * Exportada para que el AuthService la use.
 */
export function validateCredentials(username: string, password: string): boolean {
  return (
    username.trim() === VALID_CREDENTIALS.username &&
    password === VALID_CREDENTIALS.password
  );
}
