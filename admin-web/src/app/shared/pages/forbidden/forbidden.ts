import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="status-page">
      <i class="pi pi-lock status-page__icon"></i>
      <h1>Access denied</h1>
      <p>You don't have permission to view this page.</p>
      <a pButton routerLink="/dashboard" label="Back to dashboard"></a>
    </div>
  `,
  styleUrl: '../status-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Forbidden {}
