import { Request, Response } from 'express';
import { sendSuccess } from '../../../common/utils/api-response';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import type { CreateLeadBody, UpdateLeadBody } from './lead.validator';
import { leadService } from './lead.service';

function actorId(req: Request): string {
  return String((req as AuthenticatedRequest).user?.sub ?? '').trim();
}

export class LeadController {
  list = async (req: Request, res: Response): Promise<void> => {
    const data = await leadService.list(actorId(req));
    sendSuccess(res, data, 'Leads fetched');
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const data = await leadService.getById(String(req.params.id ?? ''), actorId(req));
    sendSuccess(res, data, 'Lead fetched');
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const data = await leadService.create(req.body as CreateLeadBody, actorId(req));
    sendSuccess(res, data, 'Lead created', 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const data = await leadService.update(
      String(req.params.id ?? ''),
      req.body as UpdateLeadBody,
      actorId(req),
    );
    sendSuccess(res, data, 'Lead updated');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const data = await leadService.delete(String(req.params.id ?? ''), actorId(req));
    sendSuccess(res, data, 'Lead deleted');
  };
}

export const leadController = new LeadController();
