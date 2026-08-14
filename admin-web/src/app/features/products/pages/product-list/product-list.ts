import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { AuthService } from '../../../../core/services/auth.service';
import { ProductService } from '../../services/product.service';
import {
  Category,
  Product,
  ProductStockState,
  productImageUrls,
  productStockQty,
  productStockState,
} from '../../models/product.models';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    DecimalPipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    DialogModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
    StatCard,
    CanDirective,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  private readonly products = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly searchTerm = signal('');
  readonly categoryFilter = signal<string | null>(null);
  readonly statusFilter = signal<string>('all');
  readonly stockFilter = signal<string>('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly deleteTarget = signal<Product | null>(null);
  readonly deleting = signal(false);
  readonly approvingId = signal<string | null>(null);

  readonly categoryOptions = computed(() => [
    { label: 'All categories', value: null },
    ...this.categories().map((c) => ({ label: c.name, value: c.id })),
  ]);

  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Draft', value: 'draft' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Inactive', value: 'inactive' },
  ];

  readonly stockOptions = [
    { label: 'All stock', value: 'all' },
    { label: 'Healthy', value: 'healthy' },
    { label: 'Low stock', value: 'low' },
    { label: 'Out of stock', value: 'out' },
  ];

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      !!this.categoryFilter() ||
      this.statusFilter() !== 'all' ||
      this.stockFilter() !== 'all',
  );

  readonly stats = computed(() => {
    const items = this.items();
    return {
      total: items.length,
      active: items.filter((p) => String(p.status).toLowerCase() === 'active').length,
      pending: items.filter((p) => String(p.status).toLowerCase() === 'pending_approval').length,
      low: items.filter((p) => productStockState(p) === 'low').length,
      out: items.filter((p) => productStockState(p) === 'out').length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.categoryFilter();
    const status = this.statusFilter();
    const stock = this.stockFilter();
    return this.items().filter((p) => {
      const matchesTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.sku ?? '').toLowerCase().includes(term) ||
        (p.brand ?? '').toLowerCase().includes(term);
      const matchesCategory = !category || p.categoryId === category;
      const matchesStatus = status === 'all' || String(p.status).toLowerCase() === status;
      const matchesStock = stock === 'all' || productStockState(p) === stock;
      return matchesTerm && matchesCategory && matchesStatus && matchesStock;
    });
  });

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly pageFrom = computed(() => (this.filtered().length === 0 ? 0 : this.pageFirst() + 1));

  readonly pageTo = computed(() =>
    Math.min(this.pageFirst() + this.pageSize(), this.filtered().length),
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  readonly currentPage = computed(() => Math.floor(this.pageFirst() / this.pageSize()) + 1);

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const from = Math.max(1, end - 4);
    return Array.from({ length: end - from + 1 }, (_, i) => from + i);
  });

  constructor() {
    this.load();
    this.products.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => void 0,
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.products.list({ status: 'all', limit: 500 }).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  trackById(_index: number, product: Product): string {
    return product.id;
  }

  categoryName(product: Product): string {
    if (product.category?.trim()) return product.category;
    if (!product.categoryId) return '—';
    return this.categories().find((c) => c.id === product.categoryId)?.name ?? product.categoryId;
  }

  thumb(product: Product): string | null {
    return productImageUrls(product)[0] ?? null;
  }

  stockQty(product: Product): number {
    return productStockQty(product);
  }

  stockState(product: Product): ProductStockState {
    return productStockState(product);
  }

  stockLabel(product: Product): string {
    const state = productStockState(product);
    if (state === 'out') return 'Out of stock';
    if (state === 'low') return 'Low stock';
    return 'Healthy';
  }

  resetPage(): void {
    this.pageFirst.set(0);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.pageFirst.set((next - 1) * this.pageSize());
  }

  changePageSize(rows: number): void {
    this.pageSize.set(rows || 10);
    this.resetPage();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.categoryFilter.set(null);
    this.statusFilter.set('all');
    this.stockFilter.set('all');
    this.resetPage();
  }

  new(): void {
    this.router.navigate(['/products/new']);
  }

  view(product: Product): void {
    this.router.navigate(['/products', product.id, 'view']);
  }

  edit(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }

  isPendingApproval(product: Product): boolean {
    return String(product.status).toLowerCase() === 'pending_approval';
  }

  /** Employees can submit for approval but cannot publish. */
  canApproveProducts(): boolean {
    const role = String(this.auth.user()?.roleName ?? '')
      .trim()
      .toLowerCase();
    return role !== 'employee';
  }

  approve(product: Product): void {
    if (this.approvingId() || !this.isPendingApproval(product)) return;
    this.approvingId.set(product.id);
    this.products.approve(product.id).subscribe({
      next: (updated) => {
        this.items.update((items) =>
          items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        );
        this.approvingId.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Product approved',
          detail: `${updated.name} is now visible to customers.`,
        });
      },
      error: (err: unknown) => {
        this.approvingId.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Approval failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  askDelete(product: Product): void {
    if (this.deleting()) return;
    this.deleteTarget.set(product);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const product = this.deleteTarget();
    if (!product || this.deleting()) return;

    this.deleting.set(true);
    this.products.delete(product.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((p) => p.id !== product.id));
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Product deleted',
          detail: product.name,
        });
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || err.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}
