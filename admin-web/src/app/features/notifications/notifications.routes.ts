// import { Routes } from '@angular/router';

// export const NOTIFICATIONS_ROUTES: Routes = [
//   {
//     path: '',
//     loadComponent: () =>
//       import('../../shared/pages/module-placeholder/module-placeholder').then(
//         (m) => m.ModulePlaceholder,
//       ),
//     data: { title: 'Notifications' },
//   },
// ];

import { Routes } from '@angular/router';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/notification-list/notification-list').then((m) => m.NotificationList),
    data: { title: 'Notifications' },
  },
];
