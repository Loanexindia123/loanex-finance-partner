import { Request, Response } from 'express';
import { sendSuccess } from '../../../common/utils/api-response';
import { branchService } from './branch.service';
import type { CreateBranchBody, UpdateBranchBody } from './branch.validator';

export class BranchController {
  list = async (_req: Request, res: Response) => {
    const data = await branchService.list();
    return sendSuccess(res, data, 'Master data fetched');
  };

  getById = async (req: Request, res: Response) => {
    const data = await branchService.getById(String(req.params.id ?? ''));
    return sendSuccess(res, data, 'Branch fetched');
  };

  create = async (req: Request, res: Response) => {
    const data = await branchService.create(req.body as CreateBranchBody);
    return sendSuccess(res, data, 'Master record created', 201);
  };

  update = async (req: Request, res: Response) => {
    const data = await branchService.update(
      String(req.params.id ?? ''),
      req.body as UpdateBranchBody,
    );
    return sendSuccess(res, data, 'Master record updated');
  };

  remove = async (req: Request, res: Response) => {
    const data = await branchService.delete(String(req.params.id ?? ''));
    return sendSuccess(res, data, 'Master record deleted');
  };
}

export const branchController = new BranchController();
