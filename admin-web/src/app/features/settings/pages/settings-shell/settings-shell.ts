import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeader],
  templateUrl: './settings-shell.html',
  styleUrl: './settings-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShell {
  // readonly tabs = [{ label: 'Branches', icon: 'pi-building', route: 'branches' }];
  readonly tabs = [
    { label: 'Branches', icon: 'pi-building', route: 'branches' },
    { label: 'Profile', icon: 'pi-user', route: 'profile' },
  ];
}