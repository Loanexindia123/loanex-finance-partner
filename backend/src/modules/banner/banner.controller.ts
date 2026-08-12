import { randomUUID } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { jsonDb } from '../../config/json-db';
import { authenticate } from '../../common/middleware/authenticate';
import { requireAnyPermission } from '../../common/middleware/require-permission';
import { asyncHandler } from '../../common/utils/async-handler';

export const bannerRouter = Router();

const PLACEMENTS = new Set(['home', 'promotional', 'product']);

function publicOrigin(req: Request): string {
  const proto = String(req.protocol || 'https').split(',')[0].trim() || 'https';
  const host = String(req.get('host') || '').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://loanex-api.vercel.app';
}

function persistImageUrl(imageUrl: string): string {
  const trimmed = (imageUrl || '').trim();
  const stored = trimmed.match(/(\/api\/v1\/products\/images\/[a-f0-9]{24})/i);
  if (stored) return stored[1];
  return trimmed;
}

function toPublicImageUrl(imageUrl: string, req: Request): string {
  const trimmed = persistImageUrl(imageUrl);
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  const origin = publicOrigin(req);
  return trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}

function inferPlacement(row: any, sortOrder: number): string {
  const raw = String(row?.placement ?? row?.type ?? '').toLowerCase();
  if (PLACEMENTS.has(raw)) return raw;
  if (sortOrder >= 20) return 'product';
  if (sortOrder >= 10) return 'promotional';
  return 'home';
}

function defaultSortOrder(placement: string, sortOrder: unknown): number {
  if (sortOrder != null && sortOrder !== '') return Number(sortOrder);
  if (placement === 'promotional') return 10;
  if (placement === 'product') return 20;
  return 0;
}

function mapBanner(row: any, req: Request) {
  const sortOrder = Number(row.sort_order ?? row.sortOrder ?? 0);
  const placement = inferPlacement(row, sortOrder);
  const imageUrl = toPublicImageUrl(row.image_url ?? row.imageUrl ?? '', req);
  return {
    id: row.id,
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    badgeText: row.badgeText ?? row.badge_text ?? '',
    imageUrl,
    link: row.link ?? '/',
    placement,
    sortOrder,
    status: row.status ?? 'active',
    createdAt: row.createdAt ?? row.created_at,
  };
}

function bannerRecord(input: {
  title: string;
  subtitle?: string;
  badgeText?: string;
  imageUrl: string;
  link?: string;
  placement?: string;
  sortOrder?: unknown;
  status?: string;
}) {
  const placement = PLACEMENTS.has(String(input.placement || '').toLowerCase())
    ? String(input.placement).toLowerCase()
    : 'home';
  const sortOrder = defaultSortOrder(placement, input.sortOrder);
  const status = String(input.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const title = input.title.trim();
  const subtitle = input.subtitle?.trim() ?? '';
  const badgeText = input.badgeText?.trim() ?? '';
  const imageUrl = persistImageUrl(input.imageUrl);
  const link = input.link?.trim() || '/';
  return {
    title,
    subtitle,
    badgeText,
    badge_text: badgeText,
    image_url: imageUrl,
    imageUrl,
    link,
    placement,
    sort_order: sortOrder,
    status,
  };
}

// GET /api/v1/banners - Active banners for website + app
bannerRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = jsonDb
      .findMany('banners', { status: 'active' })
      .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    return res.json({
      success: true,
      message: 'Banners fetched successfully',
      data: banners.map((b: any) => mapBanner(b, req)),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/banners/manage - All banners for admin (including inactive)
bannerRouter.get(
  '/manage',
  authenticate,
  requireAnyPermission('masters.view', 'products.view'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = jsonDb
        .findMany('banners')
        .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
      return res.json({
        success: true,
        message: 'Banners fetched successfully',
        data: banners.map((b: any) => mapBanner(b, req)),
      });
    } catch (error) {
      next(error);
    }
  }),
);

// POST /api/v1/banners - Create banner
bannerRouter.post(
  '/',
  authenticate,
  requireAnyPermission('masters.create', 'products.create'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, subtitle, badgeText, imageUrl, link, sortOrder, placement, status } = req.body;
      if (!title?.trim()) {
        return res.status(400).json({ success: false, message: 'Banner title is required' });
      }
      if (!imageUrl?.trim() || String(imageUrl).startsWith('blob:')) {
        return res.status(400).json({ success: false, message: 'Banner image is required' });
      }
      const banner = await jsonDb.insertAwaited(
        'banners',
        {
          id: randomUUID(),
          ...bannerRecord({ title, subtitle, badgeText, imageUrl, link, sortOrder, placement, status }),
        },
      );
      return res.status(201).json({
        success: true,
        message: 'Banner created',
        data: mapBanner(banner, req),
      });
    } catch (error) {
      next(error);
    }
  }),
);

// PUT /api/v1/banners/:id - Update banner
bannerRouter.put(
  '/:id',
  authenticate,
  requireAnyPermission('masters.edit', 'products.edit'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = jsonDb.findOne('banners', { id });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      const { title, subtitle, badgeText, imageUrl, link, sortOrder, placement, status } = req.body;
      const nextTitle = title?.trim() || existing.title;
      const nextImage = String(imageUrl ?? existing.image_url ?? existing.imageUrl ?? '').trim();
      if (!nextTitle) {
        return res.status(400).json({ success: false, message: 'Banner title is required' });
      }
      if (!nextImage || nextImage.startsWith('blob:')) {
        return res.status(400).json({ success: false, message: 'Banner image is required' });
      }
      const banner = await jsonDb.updateAwaited(
        'banners',
        { id },
        bannerRecord({
          title: nextTitle,
          subtitle: subtitle ?? existing.subtitle,
          badgeText: badgeText ?? existing.badgeText ?? existing.badge_text,
          imageUrl: nextImage,
          link: link ?? existing.link,
          sortOrder: sortOrder ?? existing.sort_order ?? existing.sortOrder,
          placement: placement ?? existing.placement,
          status: status ?? existing.status,
        }),
      );
      return res.json({
        success: true,
        message: 'Banner updated',
        data: mapBanner(banner, req),
      });
    } catch (error) {
      next(error);
    }
  }),
);

// DELETE /api/v1/banners/:id - Delete banner
bannerRouter.delete(
  '/:id',
  authenticate,
  requireAnyPermission('masters.delete', 'products.delete'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = jsonDb.findOne('banners', { id });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      await jsonDb.deleteAwaited('banners', { id });
      return res.json({ success: true, message: 'Banner deleted' });
    } catch (error) {
      next(error);
    }
  }),
);
