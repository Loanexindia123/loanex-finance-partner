import { ChangeDetectionStrategy, Component, computed, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  EmiPlanEntry,
  SERVICE_CHARGE_METHODS,
  createEmptyEmiPlan,
  normalizeEmiPlan,
} from '../../models/product.models';
import { computeEmiRowCalculations, parseAmount } from '../../utils/wizard-calculations';

export interface ProductEmiSettings {
  defaultDownPaymentPercent: string;
  minCustomerDownPayment: string;
  maxDownPayment: string;
  downPaymentEditableAtApproval: boolean;
  serviceChargeMethod: string;
  documentationCharge: string;
  verificationCharge: string;
  firstEmiDueAfter: string;
  gracePeriod: string;
}

export interface ProductEmiConfigValue {
  emiPlans: EmiPlanEntry[];
  settings: ProductEmiSettings;
}

@Component({
  selector: 'app-product-emi-config',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
  ],
  templateUrl: './product-emi-config.html',
  styleUrl: './product-emi-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEmiConfig implements OnInit {
  readonly sellingPrice = input(0);
  readonly plans = input<EmiPlanEntry[]>([]);
  readonly settings = input<ProductEmiSettings>({
    defaultDownPaymentPercent: '',
    minCustomerDownPayment: '',
    maxDownPayment: '',
    downPaymentEditableAtApproval: false,
    serviceChargeMethod: '',
    documentationCharge: '',
    verificationCharge: '',
    firstEmiDueAfter: '',
    gracePeriod: '',
  });

  readonly changed = output<ProductEmiConfigValue>();

  readonly draftPlans = signal<EmiPlanEntry[]>([]);
  readonly draftSettings = signal<ProductEmiSettings>({
    defaultDownPaymentPercent: '',
    minCustomerDownPayment: '',
    maxDownPayment: '',
    downPaymentEditableAtApproval: false,
    serviceChargeMethod: '',
    documentationCharge: '',
    verificationCharge: '',
    firstEmiDueAfter: '',
    gracePeriod: '',
  });

  readonly emiModalOpen = signal(false);
  readonly emiEditing = signal<EmiPlanEntry | null>(null);

  readonly serviceChargeMethodOptions = SERVICE_CHARGE_METHODS.map((value) => ({
    label: value,
    value,
  }));
  readonly emiVisibilityOptions = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];

  readonly emiModalCalcs = computed(() => {
    const plan = this.emiEditing();
    if (!plan) return null;
    return computeEmiRowCalculations(this.sellingPrice(), plan);
  });

  ngOnInit(): void {
    this.hydrate();
  }

  hydrate(): void {
    this.draftPlans.set(this.plans().map((plan) => normalizeEmiPlan(plan)));
    this.draftSettings.set({ ...this.settings() });
  }

  emiRowCalcs(index: number) {
    const plan = this.draftPlans()[index];
    if (!plan) {
      return computeEmiRowCalculations(0, createEmptyEmiPlan());
    }
    return computeEmiRowCalculations(this.sellingPrice(), plan);
  }

  numOrEmpty(value: string): number | null {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  strOrEmpty(value: number | null | undefined): string {
    return value == null ? '' : String(value);
  }

  patchSettings(patch: Partial<ProductEmiSettings>): void {
    this.draftSettings.update((current) => ({ ...current, ...patch }));
    this.emitChange();
  }

  openAddEmiModal(): void {
    this.emiEditing.set(createEmptyEmiPlan());
    this.emiModalOpen.set(true);
  }

  openEditEmiModal(index: number): void {
    const plan = this.draftPlans()[index];
    if (!plan) return;
    this.emiEditing.set({ ...normalizeEmiPlan(plan) });
    this.emiModalOpen.set(true);
  }

  updateEmiDraft(patch: Partial<EmiPlanEntry>): void {
    const current = this.emiEditing();
    if (!current) return;
    this.emiEditing.set({ ...current, ...patch });
  }

  saveEmiModal(): void {
    const plan = this.emiEditing();
    if (!plan) return;
    const normalized = normalizeEmiPlan(plan);
    this.draftPlans.update((plans) => {
      const index = plans.findIndex((row) => row.id === normalized.id);
      if (index >= 0) {
        const next = [...plans];
        next[index] = normalized;
        return next;
      }
      return [...plans, normalized];
    });
    this.emiModalOpen.set(false);
    this.emiEditing.set(null);
    this.emitChange();
  }

  closeEmiModal(): void {
    this.emiModalOpen.set(false);
    this.emiEditing.set(null);
  }

  removeEmiPlan(index: number): void {
    this.draftPlans.update((plans) => plans.filter((_, i) => i !== index));
    this.emitChange();
  }

  togglePlanEnabled(index: number, enabled: boolean): void {
    this.draftPlans.update((plans) =>
      plans.map((plan, i) => (i === index ? { ...plan, enabled } : plan)),
    );
    this.emitChange();
  }

  money(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const amount = parseAmount(value);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  inr(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  getValue(): ProductEmiConfigValue {
    return {
      emiPlans: this.draftPlans().map((plan) => normalizeEmiPlan(plan)),
      settings: { ...this.draftSettings() },
    };
  }

  private emitChange(): void {
    this.changed.emit(this.getValue());
  }
}
