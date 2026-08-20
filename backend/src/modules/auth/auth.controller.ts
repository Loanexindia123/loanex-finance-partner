import { Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response';
import { BadRequestError } from '../../common/errors/app-error';
import {
  AdminLoginBody,
  AdminForgotPasswordBody,
  AdminResetPasswordBody,
  AdminVerifyResetOtpBody,
  ChangePasswordBody,
  CompleteRegistrationBody,
  ForgotPasswordBody,
  LoginBody,
  DealerLoginBody,
  RegisterBody,
  ResetPasswordBody,
  SendOtpBody,
  VerifyOtpBody,
} from './auth.dto';
import { authService } from './auth.service';
import {
  clearRefreshTokenCookie,
  readRefreshToken,
  setRefreshTokenCookie,
} from './auth-cookies';
import type { AuthenticatedRequest } from '../../common/middleware/authenticate';

function maybeSetRefreshCookie(res: Response, data: Record<string, unknown>): void {
  const refreshToken = data?.refreshToken;
  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    setRefreshTokenCookie(res, refreshToken);
  }
}

export class AuthController {
  getMe = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user!.sub;
    const data = await authService.getMe(userId);
    sendSuccess(res, data, 'User profile fetched');
  };
  register = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.register(req.body as RegisterBody);
    sendSuccess(res, data, data.message, 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.login(req.body as LoginBody);
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message);
  };

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.adminLogin(req.body as AdminLoginBody, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message);
  };

  dealerLogin = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.dealerLogin(req.body as DealerLoginBody);
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message);
  };

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.sendOtp(req.body as SendOtpBody);
    sendSuccess(res, data, data.message);
  };

  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.verifyOtp(req.body as VerifyOtpBody);
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message);
  };

  completeRegistration = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.completeRegistration(
      req.body as CompleteRegistrationBody,
    );
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message, 201);
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.forgotPassword(req.body as ForgotPasswordBody);
    sendSuccess(res, data, data.message);
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.resetPassword(req.body as ResetPasswordBody);
    sendSuccess(res, data, data.message);
  };

  adminForgotPassword = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.adminForgotPassword(req.body as AdminForgotPasswordBody);
    sendSuccess(res, data, data.message);
  };

  adminVerifyResetOtp = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.adminVerifyResetOtp(req.body as AdminVerifyResetOtpBody);
    sendSuccess(res, data, data.message);
  };

  adminResetPassword = async (req: Request, res: Response): Promise<void> => {
    const data = await authService.adminResetPassword(req.body as AdminResetPasswordBody);
    sendSuccess(res, data, data.message);
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user!.sub;
    const data = await authService.changePassword(
      userId,
      req.body as ChangePasswordBody,
    );
    sendSuccess(res, data, data.message);
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }
    const data = await authService.refreshToken({ refreshToken });
    maybeSetRefreshCookie(res, data as unknown as Record<string, unknown>);
    sendSuccess(res, data, data.message);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = readRefreshToken(req);
    const data = refreshToken
      ? await authService.logout({ refreshToken })
      : { loggedOut: true, message: 'Logged out' };
    clearRefreshTokenCookie(res);
    sendSuccess(res, data, data.message);
  };
}

export const authController = new AuthController();
