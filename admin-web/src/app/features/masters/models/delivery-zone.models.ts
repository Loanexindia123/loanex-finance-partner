export type DeliveryZoneStatus = 'active' | 'inactive';

export interface DeliveryZone {
  id: string;
  name: string;
  pinCodes: string;
  standardDeliveryDays: string;
  status: DeliveryZoneStatus;
  createdAt?: string;
  updatedAt?: string;
}

function asString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  return String(value ?? '').trim();
}

export function normalizeDeliveryZone(raw: unknown): DeliveryZone {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    pinCodes: asString(row['pinCodes'] ?? row['pincodes'] ?? row['pin_codes']),
    standardDeliveryDays: String(
      row['standardDeliveryDays'] ?? row['deliveryDays'] ?? row['slaDays'] ?? '',
    ).trim(),
    status,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function deliveryZonePayload(input: {
  name: string;
  pinCodes: string;
  standardDeliveryDays: string;
  active: boolean;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    pinCodes: input.pinCodes.trim(),
    standardDeliveryDays: input.standardDeliveryDays.trim(),
    status: input.active ? 'active' : 'inactive',
  };
}
