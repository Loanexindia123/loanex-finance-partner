export type DeliveryPartnerStatus = 'active' | 'inactive';

export interface DeliveryPartner {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  serviceableZones: string[];
  deliverySlaDays: number | null;
  status: DeliveryPartnerStatus;
  createdAt?: string;
  updatedAt?: string;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeDeliveryPartner(raw: unknown): DeliveryPartner {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const slaRaw = row['deliverySlaDays'] ?? row['deliverySla'] ?? row['slaDays'];
  const slaNum = slaRaw === '' || slaRaw == null ? null : Number(slaRaw);

  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    contactPerson: String(row['contactPerson'] ?? row['contact'] ?? '').trim(),
    phone: String(row['phone'] ?? row['phoneNumber'] ?? row['mobile'] ?? '').trim(),
    serviceableZones: toStringArray(row['serviceableZones'] ?? row['zones']),
    deliverySlaDays: Number.isFinite(slaNum) ? slaNum : null,
    status,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function deliveryPartnerPayload(input: {
  name: string;
  contactPerson: string;
  phone: string;
  serviceableZones: string[];
  deliverySlaDays: number | null;
  active: boolean;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    contactPerson: input.contactPerson.trim(),
    phone: input.phone.trim(),
    serviceableZones: input.serviceableZones,
    deliverySlaDays: input.deliverySlaDays,
    status: input.active ? 'active' : 'inactive',
  };
}
