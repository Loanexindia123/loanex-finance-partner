import { Request, Response } from 'express';
import { ForbiddenError } from '../../../common/errors/app-error';
import { sendSuccess } from '../../../common/utils/api-response';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { employeeService } from './employee.service';
import type { CreateEmployeeBody, UpdateEmployeeBody } from './employee.validator';

function actorId(req: Request): string {
  const user = (req as AuthenticatedRequest).user;
  const id = String(user?.sub ?? '').trim();
  if (!id) {
    throw new ForbiddenError('Not authorized for this action');
  }
  return id;
}

export class EmployeeController {
  list = async (req: Request, res: Response) => {
    const data = await employeeService.list(actorId(req));
    return sendSuccess(res, data, 'Employees fetched');
  };

  listOnboarders = async (req: Request, res: Response) => {
    const data = await employeeService.listOnboarders(actorId(req));
    return sendSuccess(res, data, 'Employee onboarders fetched');
  };

  getById = async (req: Request, res: Response) => {
    const data = await employeeService.getById(String(req.params.id ?? ''), actorId(req));
    return sendSuccess(res, data, 'Employee fetched');
  };

  create = async (req: Request, res: Response) => {
    const data = await employeeService.create(req.body as CreateEmployeeBody, actorId(req));
    return sendSuccess(res, data, 'Employee onboarding saved', 201);
  };

  update = async (req: Request, res: Response) => {
    const data = await employeeService.update(
      String(req.params.id ?? ''),
      req.body as UpdateEmployeeBody,
      actorId(req),
    );
    return sendSuccess(res, data, 'Employee onboarding updated');
  };

  remove = async (req: Request, res: Response) => {
    const data = await employeeService.delete(String(req.params.id ?? ''), actorId(req));
    return sendSuccess(res, data, 'Employee onboarding record deleted');
  };
}

export const employeeController = new EmployeeController();
