export type FiCaseStatus = 'pending' | 'in_progress' | 'completed' | 'hold';

export interface FiCase {
  id: string;
  customerName: string;
  mobile: string;
  productName: string;
  assignedExecutive: string;
  assignedDate: string;
  status: FiCaseStatus;
  applicationId?: string;
  photoCount?: number;
  gpsLocation?: string;
  remarks?: string;
}

export const FI_STATUS_LABEL: Record<FiCaseStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  /** FI Accept — investigation completed successfully (not final EMI approval). */
  completed: 'Accepted',
  /** FI Reject — investigation failed / rejected. */
  hold: 'Rejected',
};

export const FI_STATUS_FILTERS: { label: string; value: 'all' | FiCaseStatus }[] = [
  { label: 'All Cases', value: 'all' },
  { label: FI_STATUS_LABEL.pending, value: 'pending' },
  { label: FI_STATUS_LABEL.in_progress, value: 'in_progress' },
  { label: FI_STATUS_LABEL.completed, value: 'completed' },
  { label: FI_STATUS_LABEL.hold, value: 'hold' },
];
