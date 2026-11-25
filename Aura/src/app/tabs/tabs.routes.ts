import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { authGuard, roleGuard } from '../guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    canActivate: [authGuard],
    children: [
      // --- Vistas del Cuidador ---
      {
        path: 'cuidador-inicio',
        canActivate: [roleGuard('cuidador')],
        loadComponent: () =>
          import('../cuidador/inicio/cuidador-inicio.page').then(
            (m) => m.CuidadorInicioPage
          ),
      },
      {
        path: 'cuidador-alertas',
        canActivate: [roleGuard('cuidador')],
        loadComponent: () =>
          import('../cuidador/alertas/cuidador-alertas.page').then(
            (m) => m.CuidadorAlertasPage
          ),
      },
      {
        path: 'cuidador-mapa',
        canActivate: [roleGuard('cuidador')],
        loadComponent: () =>
          import('../cuidador/mapa/cuidador-mapa.page').then(
            (m) => m.CuidadorMapaPage
          ),
      },
      {
        path: 'cuidador-emergencias',
        canActivate: [roleGuard('cuidador')],
        loadComponent: () =>
          import('../cuidador/emergencias/cuidador-emergencias.page').then(
            (m) => m.CuidadorEmergenciasPage
          ),
      },

      // --- Vistas del Paciente ---
      {
        path: 'paciente-sensores',
        canActivate: [roleGuard('paciente')],
        loadComponent: () =>
          import('../paciente/sensores/paciente-sensores.page').then(
            (m) => m.PacienteSensoresPage
          ),
      },
      {
        path: 'paciente-alertas',
        canActivate: [roleGuard('paciente')],
        loadComponent: () =>
          import('../paciente/alertas/paciente-alertas.page').then(
            (m) => m.PacienteAlertasPage
          ),
      },
      {
        path: 'paciente-panico',
        canActivate: [roleGuard('paciente')],
        loadComponent: () =>
          import('../paciente/panico/paciente-panico.page').then(
            (m) => m.PacientePanicoPage
          ),
      },

      {
        path: '',
        redirectTo: 'cuidador-inicio',
        pathMatch: 'full',
      },
    ],
  },
];
