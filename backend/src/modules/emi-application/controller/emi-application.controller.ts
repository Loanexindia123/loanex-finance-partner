import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { sendSuccess } from '../../../common/utils/api-response';
import type { CreateEmiApplicationBody } from '../dto/emi-application.dto';
import { emiApplicationService } from '../service/emi-application.service';

function requireUserId(req: AuthenticatedRequest): string {
  return req.user!.sub;
}

function parseEvent(req: Request): 'viewed' | 'refreshed' | undefined {
  const value = typeof req.query.event === 'string' ? req.query.event.toLowerCase() : '';
  if (value === 'refreshed' || value === 'refresh') return 'refreshed';
  if (value === 'viewed' || value === 'view') return 'viewed';
  return undefined;
}

function parseApplicationId(req: Request): string | undefined {
  const q = typeof req.query.applicationId === 'string' ? req.query.applicationId.trim() : '';
  if (q) return q;
  const bodyId =
    typeof (req.body as { applicationId?: string })?.applicationId === 'string'
      ? String((req.body as { applicationId?: string }).applicationId).trim()
      : '';
  return bodyId || undefined;
}

export class EmiApplicationController {
  getReview = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getReview(
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'Verification review loaded');
  };

  create = async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = await emiApplicationService.create(
      requireUserId(authReq),
      req.body as CreateEmiApplicationBody,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    );
    return sendSuccess(res, data, 'EMI application submitted successfully', 201);
  };

  getCurrent = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getCurrent(
      requireUserId(req as AuthenticatedRequest),
      {
        event: parseEvent(req) ?? 'viewed',
        ipAddress: req.ip,
        applicationId: parseApplicationId(req),
      },
    );
    return sendSuccess(res, data, 'Current EMI application fetched');
  };

  getById = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId ?? '');
    const data = await emiApplicationService.getById(
      requireUserId(req as AuthenticatedRequest),
      applicationId,
      {
        event: parseEvent(req) ?? 'viewed',
        ipAddress: req.ip,
      },
    );
    return sendSuccess(res, data, 'EMI application fetched');
  };

  getStatus = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getStatus(
      requireUserId(req as AuthenticatedRequest),
      {
        event: parseEvent(req),
        ipAddress: req.ip,
      },
    );
    return sendSuccess(res, data, 'EMI application status fetched');
  };

  getCurrentOffer = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getCurrentOffer(
      requireUserId(req as AuthenticatedRequest),
      { ipAddress: req.ip, applicationId: parseApplicationId(req) },
    );
    return sendSuccess(res, data, 'Approved loan offer fetched');
  };

  acceptOffer = async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = await emiApplicationService.acceptOffer(requireUserId(authReq), {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      applicationId: parseApplicationId(req),
    });
    return sendSuccess(res, data, 'Loan offer accepted successfully');
  };

  declineOffer = async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = await emiApplicationService.declineOffer(requireUserId(authReq), {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      applicationId: parseApplicationId(req),
    });
    return sendSuccess(res, data, 'Loan offer declined');
  };

  savePlanDraft = async (req: Request, res: Response) => {
    const data = await emiApplicationService.savePlanDraft(
      requireUserId(req as AuthenticatedRequest),
      req.body,
    );
    return sendSuccess(res, data, 'EMI plan draft saved');
  };

  getPlanDraft = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getPlanDraft(
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'EMI plan draft fetched');
  };

  clearPlanDraft = async (req: Request, res: Response) => {
    const data = await emiApplicationService.clearPlanDraft(
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'EMI plan draft cleared');
  };

  devApprove = async (req: Request, res: Response) => {
    const data = await emiApplicationService.devApprove(
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'Application approved (dev)');
  };

  adminAssignFi = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const data = await emiApplicationService.adminAssignFi(
      applicationId,
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'FI case assigned');
  };

  adminApprove = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const data = await emiApplicationService.adminApprove(
      applicationId,
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'Application approved');
  };

  adminReject = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const data = await emiApplicationService.adminReject(
      applicationId,
      requireUserId(req as AuthenticatedRequest),
      reason,
    );
    return sendSuccess(res, data, 'Application rejected');
  };

  adminModifyTerms = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const data = await emiApplicationService.adminModifyTerms(
      applicationId,
      requireUserId(req as AuthenticatedRequest),
      req.body ?? {},
    );
    return sendSuccess(res, data, 'Loan terms modified');
  };

  listForAdmin = async (req: Request, res: Response) => {
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await emiApplicationService.listForAdmin(status);
    return sendSuccess(res, data, 'Admin EMI applications fetched');
  };

  getByIdForAdmin = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId ?? '');
    const data = await emiApplicationService.getForAdmin(applicationId);
    return sendSuccess(res, data, 'Admin EMI application fetched');
  };

  getHistory = async (req: Request, res: Response) => {
    const data = await emiApplicationService.getHistory(
      requireUserId(req as AuthenticatedRequest),
    );
    return sendSuccess(res, data, 'EMI applications history fetched');
  };
}

export const emiApplicationController = new EmiApplicationController();
