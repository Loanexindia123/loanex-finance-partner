import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const FREELANCER_AGENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/freelancer-agent-list/freelancer-agent-list').then(
        (m) => m.FreelancerAgentList,
      ),
    data: { title: 'Freelancer / Growing Partner' },
  },
  {
    path: 'onboard',
    canActivate: [permissionGuard('freelancers.create')],
    loadComponent: () =>
      import('./pages/freelancer-agent-onboard/freelancer-agent-onboard').then(
        (m) => m.FreelancerAgentOnboard,
      ),
    data: { title: 'Freelancer Agent Onboarding Form' },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/freelancer-agent-view/freelancer-agent-view').then(
        (m) => m.FreelancerAgentView,
      ),
    data: { title: 'Freelancer / Growing Partner Profile' },
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard('freelancers.edit')],
    loadComponent: () =>
      import('./pages/freelancer-agent-onboard/freelancer-agent-onboard').then(
        (m) => m.FreelancerAgentOnboard,
      ),
    data: { title: 'Edit Freelancer Onboarding' },
  },
];
