import { FiCase, FiCaseStatus } from '../../types/fiCase';
import { updateFiCase } from '../../services/emiService';

export type FiPhotoKey =
  | 'houseFront'
  | 'houseInside'
  | 'customerWithHouse'
  | 'businessShop'
  | 'customerSelfie';

export const FI_PHOTO_LABELS: Record<FiPhotoKey, string> = {
  houseFront: 'House Front Photo',
  houseInside: 'House Inside Photo',
  customerWithHouse: 'Customer with House',
  businessShop: 'Business / Shop Photo',
  customerSelfie: 'Customer Selfie',
};

export interface FiChecklistState {
  customerAvailable: boolean;
  addressVerified: boolean;
  deliveryLocationVerified: boolean;
  documentsVerified: boolean;
}

export interface FiWorkflowDraft {
  photos: Record<FiPhotoKey, boolean>;
  latitude: string;
  longitude: string;
  address: string;
  gpsCaptured: boolean;
  visitDate: string;
  visitTime: string;
  checklist: FiChecklistState;
  remarks: string;
}

const emptyPhotos = (): Record<FiPhotoKey, boolean> => ({
  houseFront: false,
  houseInside: false,
  customerWithHouse: false,
  businessShop: false,
  customerSelfie: false,
});

const emptyDraft = (): FiWorkflowDraft => ({
  photos: emptyPhotos(),
  latitude: '',
  longitude: '',
  address: '',
  gpsCaptured: false,
  visitDate: '',
  visitTime: '',
  checklist: {
    customerAvailable: false,
    addressVerified: false,
    deliveryLocationVerified: false,
    documentsVerified: false,
  },
  remarks: '',
});

const drafts = new Map<string, FiWorkflowDraft>();
const fiCaseCache = new Map<string, FiCase>();

export function setLocalFiCase(fiCase: FiCase): void {
  fiCaseCache.set(fiCase.id, fiCase);
}

export function getFiCaseById(fiCaseId: string): FiCase | undefined {
  return fiCaseCache.get(fiCaseId);
}

/** Mock GPS payload — UI only, no device GPS */
export const MOCK_GPS = {
  latitude: '19.0760° N',
  longitude: '72.8777° E',
  address: 'Andheri East, Mumbai, Maharashtra 400069',
};

export function getFiWorkflowDraft(fiCaseId: string, customFiCase?: FiCase): FiWorkflowDraft {
  const existing = drafts.get(fiCaseId);
  if (existing) {
    return {
      ...existing,
      photos: { ...emptyPhotos(), ...existing.photos },
      checklist: { ...existing.checklist },
    };
  }

  const fiCase = customFiCase || getFiCaseById(fiCaseId);
  if (fiCase?.status === 'completed') {
    const completed: FiWorkflowDraft = {
      photos: {
        houseFront: true,
        houseInside: true,
        customerWithHouse: true,
        businessShop: true,
        customerSelfie: true,
      },
      latitude: '19.0760° N',
      longitude: '72.8777° E',
      address: fiCase.gpsLocation?.trim() || MOCK_GPS.address,
      gpsCaptured: true,
      visitDate: fiCase.assignedDate || '2026-07-28',
      visitTime: '11:30 AM',
      checklist: {
        customerAvailable: true,
        addressVerified: true,
        deliveryLocationVerified: true,
        documentsVerified: true,
      },
      remarks: fiCase.remarks?.trim() || 'Field investigation completed.',
    };
    drafts.set(fiCaseId, completed);
    return {
      ...completed,
      photos: { ...completed.photos },
      checklist: { ...completed.checklist },
    };
  }

  const draft = emptyDraft();
  if (fiCase?.remarks) draft.remarks = fiCase.remarks;
  drafts.set(fiCaseId, draft);
  return { ...draft, photos: { ...draft.photos }, checklist: { ...draft.checklist } };
}

export function saveFiDraft(fiCaseId: string, draft: FiWorkflowDraft): void {
  drafts.set(fiCaseId, {
    ...draft,
    photos: { ...draft.photos },
    checklist: { ...draft.checklist },
  });

  const fiCase = getFiCaseById(fiCaseId);
  if (fiCase && fiCase.status === 'pending') {
    fiCase.status = 'in_progress';
  }
  if (fiCase) {
    fiCase.remarks = draft.remarks;
    if (draft.gpsCaptured) {
      fiCase.gpsLocation = `${draft.latitude}, ${draft.longitude}`;
    }
    const count = Object.values(draft.photos).filter(Boolean).length;
    fiCase.photoCount = count;
  }
  // Persist status + evidence to the backend so the changes survive a reload.
  updateFiCase(fiCaseId, {
    status: fiCase?.status ?? 'in_progress',
    remarks: draft.remarks,
    gpsLocation: draft.gpsCaptured ? `${draft.latitude}, ${draft.longitude}` : undefined,
    photoCount: Object.values(draft.photos).filter(Boolean).length,
  }).catch((error) =>
    console.warn('[fiWorkflowStore] Failed to persist FI draft:', error),
  );
}

export function submitFiCase(fiCaseId: string, draft: FiWorkflowDraft): void {
  saveFiDraft(fiCaseId, draft);
  const fiCase = getFiCaseById(fiCaseId);
  if (fiCase) {
    fiCase.status = 'completed';
    fiCase.remarks = draft.remarks;
    fiCase.gpsLocation = draft.gpsCaptured
      ? `${draft.latitude}, ${draft.longitude}`
      : fiCase.gpsLocation;
    fiCase.photoCount = Object.values(draft.photos).filter(Boolean).length;
  }
  updateFiCase(fiCaseId, {
    status: 'completed',
    remarks: draft.remarks,
    gpsLocation: draft.gpsCaptured ? `${draft.latitude}, ${draft.longitude}` : undefined,
    photoCount: Object.values(draft.photos).filter(Boolean).length,
  }).catch((error) =>
    console.warn('[fiWorkflowStore] Failed to submit FI case:', error),
  );
}

export function getFiStatusLabel(status: FiCaseStatus): string {
  const labels: Record<FiCaseStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Accepted',
    hold: 'Rejected',
  };
  return labels[status];
}
