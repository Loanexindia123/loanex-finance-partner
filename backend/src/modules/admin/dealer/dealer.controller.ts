import { Request, Response } from 'express';
import { ForbiddenError } from '../../../common/errors/app-error';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { sendSuccess } from '../../../common/utils/api-response';
import { dealerService } from './dealer.service';
import type { CreateDealerBody, UpdateDealerBody } from './dealer.validator';

function actorId(req: Request): string {
  const user = (req as AuthenticatedRequest).user;
  const id = String(user?.sub ?? '').trim();
  if (!id) {
    throw new ForbiddenError('Not authorized for this action');
  }
  return id;
}

export class DealerController {
  list = async (req: Request, res: Response) => {
    const raw = req.query.approvedOnly;
    const approvedOnly =
      raw === '1' ||
      raw === 'true' ||
      (Array.isArray(raw) && (raw[0] === '1' || raw[0] === 'true'));
    const data = await dealerService.list(actorId(req), { approvedOnly });
    return sendSuccess(res, data, 'Dealers fetched');
  };

  getById = async (req: Request, res: Response) => {
    const data = await dealerService.getById(String(req.params.id ?? ''), actorId(req));
    return sendSuccess(res, data, 'Dealer fetched');
  };

  create = async (req: Request, res: Response) => {
    const data = await dealerService.create(req.body as CreateDealerBody, actorId(req));
    return sendSuccess(res, data, 'Dealer created', 201);
  };

  update = async (req: Request, res: Response) => {
    const data = await dealerService.update(
      String(req.params.id ?? ''),
      req.body as UpdateDealerBody,
      actorId(req),
    );
    return sendSuccess(res, data, 'Dealer updated');
  };

  remove = async (req: Request, res: Response) => {
    const data = await dealerService.delete(String(req.params.id ?? ''), actorId(req));
    return sendSuccess(res, data, 'Dealer deleted');
  };
}

export const dealerController = new DealerController();
