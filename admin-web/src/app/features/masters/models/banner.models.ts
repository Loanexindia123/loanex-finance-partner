export type BannerPlacement = 'home' | 'promotional' | 'product';
export type BannerStatus = 'active' | 'inactive';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  imageUrl: string;
  link: string;
  placement: BannerPlacement;
  sortOrder: number;
  status: BannerStatus;
  createdAt?: string;
}

export function normalizeBanner(raw: unknown): Banner {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sortOrder = Number(row['sortOrder'] ?? row['sort_order'] ?? 0);
  const placementRaw = String(row['placement'] ?? row['type'] ?? '').toLowerCase();
  const placement: BannerPlacement =
    placementRaw === 'promotional' || placementRaw === 'product'
      ? placementRaw
      : sortOrder >= 20
        ? 'product'
        : sortOrder >= 10
          ? 'promotional'
          : 'home';

  return {
    id: String(row['id'] ?? ''),
    title: String(row['title'] ?? '').trim(),
    subtitle: String(row['subtitle'] ?? '').trim(),
    badgeText: String(row['badgeText'] ?? row['badge_text'] ?? '').trim(),
    imageUrl: String(row['imageUrl'] ?? row['image_url'] ?? '').trim(),
    link: String(row['link'] ?? '/').trim() || '/',
    placement,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    status: String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
  };
}

export function bannerPayload(input: {
  title: string;
  subtitle: string;
  badgeText: string;
  imageUrl: string;
  link: string;
  placement: BannerPlacement;
  sortOrder: number;
  active: boolean;
}): Record<string, unknown> {
  return {
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    badgeText: input.badgeText.trim(),
    imageUrl: input.imageUrl.trim(),
    link: input.link.trim() || '/',
    placement: input.placement,
    sortOrder: Number(input.sortOrder) || 0,
    status: input.active ? 'active' : 'inactive',
  };
}
