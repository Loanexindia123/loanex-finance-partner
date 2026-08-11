import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-manageable-select',
  standalone: true,
  imports: [FormsModule, SelectModule, ButtonModule, DialogModule, InputTextModule, TooltipModule],
  templateUrl: './manageable-select.html',
  styleUrl: './manageable-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageableSelect {
  readonly label = input('');
  readonly placeholder = input('Select...');
  readonly entityName = input('Item');
  readonly entityNamePlural = input('');
  readonly options = input<string[]>([]);
  readonly value = input('');
  readonly disabled = input(false);
  readonly hint = input('');

  readonly valueChange = output<string>();
  readonly add = output<string>();
  readonly rename = output<{ from: string; to: string }>();
  readonly remove = output<string>();

  readonly manageOpen = signal(false);
  readonly addOpen = signal(false);
  readonly draft = signal('');
  readonly renameFrom = signal('');
  readonly renameTo = signal('');
  readonly note = signal('');
  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  plural(): string {
    return this.entityNamePlural() || `${this.entityName()}s`;
  }

  selectOptions(): Array<{ label: string; value: string }> {
    const current = this.value().trim();
    const base = this.options().map((name) => ({ label: name, value: name }));
    if (current && !base.some((opt) => opt.value === current)) {
      return [{ label: current, value: current }, ...base];
    }
    return base;
  }

  onSelect(next: string | null): void {
    this.note.set('');
    this.valueChange.emit(next ?? '');
  }

  openAdd(): void {
    this.draft.set('');
    this.addOpen.set(true);
  }

  openManage(): void {
    this.renameFrom.set('');
    this.renameTo.set('');
    this.manageOpen.set(true);
  }

  submitAdd(): void {
    const name = this.draft().trim();
    if (!name) return;
    this.add.emit(name);
    this.valueChange.emit(name);
    this.note.set('');
    this.addOpen.set(false);
  }

  startRename(name: string): void {
    this.renameFrom.set(name);
    this.renameTo.set(name);
  }

  submitRename(): void {
    const from = this.renameFrom();
    const to = this.renameTo().trim();
    if (!from || !to) return;
    this.rename.emit({ from, to });
    if (this.value() === from) this.valueChange.emit(to);
    this.renameFrom.set('');
    this.renameTo.set('');
  }

  deleteItem(name: string): void {
    this.remove.emit(name);
    if (this.value() === name) {
      this.valueChange.emit('');
      this.note.set(`Selected ${this.entityName().toLowerCase()} was deleted and cleared.`);
    }
  }
}
