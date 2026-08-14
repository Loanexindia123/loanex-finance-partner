export interface SalaryInputs {
  monthlyCtc?: unknown;
  basicSalary?: unknown;
  hra?: unknown;
  conveyanceAllowance?: unknown;
  specialAllowance?: unknown;
  otherAllowance?: unknown;
  variableIncentive?: unknown;
  otherDeduction?: unknown;
}

export interface SalaryTotals {
  fixedGrossSalary: string;
  totalMonthlyCtc: string;
  netTakeHome: string;
}

function toAmount(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 100) / 100);
}

/**
 * Employee CTC breakup — no existing payroll module in this repo.
 * Fixed Gross = Basic + HRA + Conveyance + Special + Other
 * Total Monthly CTC = Fixed Gross + Variable
 * Net Take-Home = Total Monthly CTC − Other Deduction
 * PF / ESI remain applicability flags only (no statutory rate table exists).
 */
export function calculateSalaryTotals(input: SalaryInputs): SalaryTotals {
  const monthlyCtc = toAmount(input.monthlyCtc);
  const fixedGross =
    toAmount(input.basicSalary) +
    toAmount(input.hra) +
    toAmount(input.conveyanceAllowance) +
    toAmount(input.specialAllowance) +
    toAmount(input.otherAllowance);
  const totalMonthlyCtc = fixedGross + toAmount(input.variableIncentive) || monthlyCtc;
  const netTakeHome = Math.max(0, totalMonthlyCtc - toAmount(input.otherDeduction));
  return {
    fixedGrossSalary: formatAmount(fixedGross),
    totalMonthlyCtc: formatAmount(totalMonthlyCtc),
    netTakeHome: formatAmount(netTakeHome),
  };
}

export function suggestBasicFromCtc(monthlyCtc: unknown): string {
  const ctc = toAmount(monthlyCtc);
  if (ctc <= 0) return '';
  return formatAmount(Math.round(ctc * 0.4));
}

export function suggestHraFromBasic(basicSalary: unknown): string {
  const basic = toAmount(basicSalary);
  if (basic <= 0) return '';
  return formatAmount(Math.round(basic * 0.4));
}
