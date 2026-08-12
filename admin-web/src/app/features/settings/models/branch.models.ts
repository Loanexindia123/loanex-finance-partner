export type BranchStatus = 'active' | 'inactive';

export interface Branch {
  id: string;
  name: string;
  branchCode: string;
  city: string;
  state: string;
  branchManager: string;
  mobile: string;
  status: BranchStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload sent on create/update — no id (server generates it) or timestamps. */
export interface BranchPayload {
  name: string;
  branchCode: string;
  city: string;
  state: string;
  branchManager: string;
  mobile: string;
  status: BranchStatus;
}