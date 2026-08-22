import { Request, Response } from 'express';
import { ForbiddenError } from '../../../common/errors/app-error';
import { sendSuccess } from '../../../common/utils/api-response';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { jsonDb } from '../../../config/json-db';
import { rolesService } from '../../rbac/roles.service';
import { freelancerAgentService } from './freelancer-agent.service';
import type {
  CreateFreelancerAgentBody,
  RejectFreelancerAgentBody,
  UpdateFreelancerAgentBody,
} from './freelancer-agent.validator';

function actorId(req: Request): string {
  const user = (req as AuthenticatedRequest).user;
  const id = String(user?.sub ?? '').trim();
  if (!id) {
    throw new ForbiddenError('Not authorized for this action');
  }
  return id;
}

function actorContext(req: Request): { id: string; name: string } {
  const id = actorId(req);
  const user = jsonDb.findOne('users', { id });
  const profile = jsonDb.findOne('profiles', { id }) as any;
  const name =
    String(profile?.fullName ?? profile?.name ?? user?.email ?? user?.phone ?? id).trim() || id;
  return { id, name };
}

async function canSeePayout(req: Request): Promise<boolean> {
  const id = actorId(req);
  const { resolveIsDealerUserId } = await import('../dealer/dealer-account');
  if (await resolveIsDealerUserId(id)) return true;
  const permissions = await rolesService.resolveUserPermissions(id);
  return (
    permissions.includes('freelancers.payout') ||
    permissions.includes('freelancers.approve') ||
    permissions.includes('freelancers.edit')
  );
}

export class FreelancerAgentController {
  list = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.list(actorId(req));
    return sendSuccess(res, data, 'Freelancer agents fetched');
  };

  listCreators = async (req: Request, res: Response) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const data = await freelancerAgentService.listCreators(actorId(req), type);
    return sendSuccess(res, data, 'Creators fetched');
  };

  getById = async (req: Request, res: Response) => {
    const payout = await canSeePayout(req);
    const data = await freelancerAgentService.getById(String(req.params.id ?? ''), actorId(req), payout);
    return sendSuccess(res, data, 'Freelancer agent fetched');
  };

  create = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.create(
      req.body as CreateFreelancerAgentBody,
      actorContext(req),
    );
    const submitted = data.formStatus === 'pending_approval';
    return sendSuccess(
      res,
      data,
      submitted
        ? 'Freelancer / Growing Partner submitted for approval.'
        : 'Freelancer draft saved',
      201,
    );
  };

  update = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.update(
      String(req.params.id ?? ''),
      req.body as UpdateFreelancerAgentBody,
      actorContext(req),
    );
    const submitted = data.formStatus === 'pending_approval';
    return sendSuccess(
      res,
      data,
      submitted
        ? 'Freelancer / Growing Partner submitted for approval.'
        : 'Freelancer draft updated',
    );
  };

  approve = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.approve(String(req.params.id ?? ''), actorContext(req));
    return sendSuccess(res, data, 'Freelancer / Growing Partner approved');
  };

  reject = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.reject(
      String(req.params.id ?? ''),
      req.body as RejectFreelancerAgentBody,
      actorContext(req),
    );
    return sendSuccess(res, data, 'Freelancer / Growing Partner rejected');
  };

  remove = async (req: Request, res: Response) => {
    const data = await freelancerAgentService.delete(String(req.params.id ?? ''), actorId(req));
    return sendSuccess(res, data, 'Freelancer onboarding record deleted');
  };
}

export const freelancerAgentController = new FreelancerAgentController();
