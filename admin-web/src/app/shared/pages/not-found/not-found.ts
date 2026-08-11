import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="status-page">
      <i class="pi pi-compass status-page__icon"></i>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a pButton routerLink="/dashboard" label="Back to dashboard"></a>
    </div>
  `,
  styleUrl: '../status-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
