import { Directive, EffectRef, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { RbacService } from '../../core/services/rbac.service';
import { Permission } from '../../core/models/permission.models';

/**
 * Structural directive to hide UI the current admin can't act on.
 * Usage: <button *appCan="'products.create'">New product</button>
 *        <button *appCan="['products.edit', 'products.delete']">...</button> (any-of)
 * UI-only convenience — the backend's requirePermission middleware remains authoritative.
 */
@Directive({
  selector: '[appCan]',
  standalone: true,
})
export class CanDirective {
  private readonly rbac = inject(RbacService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private required: (Permission | string)[] = [];
  private created = false;
  private readonly effectRef: EffectRef;

  constructor() {
    this.effectRef = effect(() => this.render());
  }

  @Input() set appCan(value: Permission | string | (Permission | string)[]) {
    this.required = Array.isArray(value) ? value : [value];
    this.render();
  }

  private render(): void {
    const allowed = this.required.length === 0 || this.rbac.canAny(...this.required);
    if (allowed && !this.created) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.created = true;
    } else if (!allowed && this.created) {
      this.viewContainer.clear();
      this.created = false;
    }
  }
}
