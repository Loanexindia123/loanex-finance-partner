import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatInr } from '../../../../shared/utils/currency';
import { LoanDashboard, LoanService } from '../../services/loan.service';

/** LoanDashboard narrowed to the "has an active loan" case — loan/summary are guaranteed present. */
type ActiveLoanDashboard = LoanDashboard & {
  loan: NonNullable<LoanDashboard['loan']>;
  summary: NonNullable<LoanDashboard['summary']>;
};

@Component({
  selector: 'app-emi-dashboard',
  imports: [RouterLink],
  templateUrl: './my-emi.html',
  styleUrl: './my-emi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmiDashboardComponent implements OnInit {
  private readonly loanApi = inject(LoanService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly dashboard = signal<ActiveLoanDashboard | null>(null);
  readonly showSchedule = signal(false);

  readonly hasActiveLoan = computed(() => this.dashboard()?.loan.loanStatus === 'ACTIVE');

  ngOnInit(): void {
    this.loadDashboard();
  }

  refresh(): void {
    this.loadDashboard();
  }

  payEmi(): void {
    const next = this.dashboard()?.nextEmi;
    if (!next?.id) {
      this.info.set('No payable EMI found for this loan.');
      return;
    }
    void this.router.navigate(['/my-emi/pay', next.id]);
  }

  viewSchedule(): void {
    this.showSchedule.set(true);
    queueMicrotask(() => {
      document.getElementById('lx-emi-schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  contactSupport(): void {
    const loan = this.dashboard()?.loan;
    void this.router.navigate(['/support'], {
      queryParams: {
        topic: 'loan',
        loanAccountNumber: loan?.loanAccountNumber ?? undefined,
        applicationNumber: loan?.applicationNumber ?? undefined,
      },
    });
  }

  downloadStatement(): void {
    this.download('statement', 'loan-statement.pdf');
  }

  downloadAgreement(): void {
    this.download('agreement', 'loan-agreement.pdf');
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return formatInr(value);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatStatus(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replaceAll('_', ' ');
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.loanApi.getDashboard().subscribe({
      next: (data) => {
        this.loading.set(false);
        // Empty dashboard (no loans) arrives as null / loan-less payload — not an error.
        if (this.hasActiveLoanData(data)) {
          this.dashboard.set(data);
        } else {
          this.dashboard.set(null);
          this.info.set('You have no active EMI loan yet.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.dashboard.set(null);
        this.error.set(this.loanApi.error() ?? 'Unable to load EMI dashboard.');
      },
    });
  }

  private hasActiveLoanData(data: LoanDashboard | null): data is ActiveLoanDashboard {
    return !!data && !!data.loan && !!data.summary;
  }

  private download(type: 'statement' | 'agreement', fallbackName: string): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.info.set(null);
    this.error.set(null);

    const loanNumber = this.dashboard()?.loan.loanAccountNumber ?? 'loan';
    const source =
      type === 'statement'
        ? this.loanApi.downloadStatement()
        : this.loanApi.downloadAgreement();

    source.subscribe({
      next: (blob) => {
        this.downloading.set(false);
        if (blob.type?.includes('application/json')) {
          void blob.text().then((text) => {
            try {
              const parsed = JSON.parse(text) as { message?: string };
              this.error.set(parsed.message ?? `Unable to download ${type}.`);
            } catch {
              this.error.set(`Unable to download ${type}.`);
            }
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${loanNumber}-${fallbackName}`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.info.set(`${type === 'statement' ? 'Loan statement' : 'Loan agreement'} downloaded.`);
      },
      error: () => {
        this.downloading.set(false);
        this.error.set(this.loanApi.error() ?? `Unable to download ${type}.`);
      },
    });
  }
}

/** @deprecated Prefer EmiDashboardComponent */
export { EmiDashboardComponent as MyEmiComponent };
