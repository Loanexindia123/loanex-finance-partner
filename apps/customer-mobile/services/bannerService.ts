import { Banner } from '../types';
import { api } from '../lib/apiClient';
import { resolveMediaUrl } from '../utils/mediaUrl';

function mapBanner(raw: any): Banner {
  return {
    id: String(raw?.id ?? ''),
    title: String(raw?.title ?? ''),
    subtitle: raw?.subtitle ?? '',
    badgeText: raw?.badgeText ?? raw?.badge_text ?? '',
    imageUrl: resolveMediaUrl(raw?.imageUrl ?? raw?.image_url ?? ''),
    linkUrl: raw?.link ?? raw?.linkUrl ?? '/',
    position: Number(raw?.sortOrder ?? raw?.sort_order ?? raw?.position ?? 0),
    isActive: String(raw?.status ?? 'active').toLowerCase() !== 'inactive',
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

export async function getBanners(): Promise<Banner[]> {
  try {
    const res = await api.get('/banners');
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapBanner).filter((banner: Banner) => banner.imageUrl);
  } catch {
    return [];
  }
}

export async function getBanner(id: string): Promise<Banner | null> {
  const { data } = await api.get(`/banners/${id}`);
  return data || null;
}

export async function createBanner(b: Omit<Banner, 'id' | 'createdAt'>): Promise<Banner> {
  const res = await api.post('/banners', b);
  return res.data;
}

export async function updateBanner(id: string, updates: Partial<Banner>): Promise<void> {
  await api.put(`/banners/${id}`, updates);
}

export async function deleteBanner(id: string): Promise<void> {
  await api.delete(`/banners/${id}`);
}
