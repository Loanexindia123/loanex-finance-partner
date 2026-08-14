import { Router } from 'express';
import { createRateLimiter } from '../../common/middleware/rate-limiter';
import { asyncHandler } from '../../common/utils/async-handler';
import { validateRequest } from '../../common/middleware/validate';
import { env } from '../../config/env';
import { authController } from './auth.controller';
import {
  adminForgotPasswordBodySchema,
  adminLoginBodySchema,
  adminResetPasswordBodySchema,
  adminVerifyResetOtpBodySchema,
  changePasswordBodySchema,
  completeRegistrationBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshTokenBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sendOtpBodySchema,
  verifyOtpBodySchema,
} from './auth.validator';

const authRateLimiter = createRateLimiter({
  max: env.AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: 'TOO_MANY_REQUESTS',
  },
});

import { authenticate } from '../../common/middleware/authenticate';

export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(authController.getMe),
);

authRouter.post(
  '/register',
  validateRequest(registerBodySchema),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  validateRequest(loginBodySchema),
  asyncHandler(authController.login),
);

authRouter.post(
  '/admin-login',
  validateRequest(adminLoginBodySchema),
  asyncHandler(authController.adminLogin),
);

authRouter.post(
  '/send-otp',
  validateRequest(sendOtpBodySchema),
  asyncHandler(authController.sendOtp),
);

authRouter.post(
  '/verify-otp',
  validateRequest(verifyOtpBodySchema),
  asyncHandler(authController.verifyOtp),
);

authRouter.post(
  '/complete-registration',
  validateRequest(completeRegistrationBodySchema),
  asyncHandler(authController.completeRegistration),
);

authRouter.post(
  '/forgot-password',
  validateRequest(forgotPasswordBodySchema),
  asyncHandler(authController.forgotPassword),
);

authRouter.post(
  '/reset-password',
  validateRequest(resetPasswordBodySchema),
  asyncHandler(authController.resetPassword),
);

authRouter.post(
  '/admin-forgot-password',
  validateRequest(adminForgotPasswordBodySchema),
  asyncHandler(authController.adminForgotPassword),
);

authRouter.post(
  '/admin-verify-reset-otp',
  validateRequest(adminVerifyResetOtpBodySchema),
  asyncHandler(authController.adminVerifyResetOtp),
);

authRouter.post(
  '/admin-reset-password',
  validateRequest(adminResetPasswordBodySchema),
  asyncHandler(authController.adminResetPassword),
);

authRouter.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordBodySchema),
  asyncHandler(authController.changePassword),
);

authRouter.post(
  '/refresh-token',
  validateRequest(refreshTokenBodySchema),
  asyncHandler(authController.refreshToken),
);

authRouter.post(
  '/logout',
  validateRequest(logoutBodySchema),
  asyncHandler(authController.logout),
);
