import { z } from 'zod';

export const indianMobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be a 6-digit code');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name must be at most 100 characters');

export const otpPurposeSchema = z.enum([
  'REGISTER',
  'LOGIN',
  'FORGOT_PASSWORD',
  'RESET_PASSWORD',
]);

export const registerBodySchema = z.object({
  fullName: fullNameSchema,
  mobile: indianMobileSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginBodySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Email or mobile is required')
    .max(255),
  password: z.string().min(1, 'Password is required'),
});

export const dealerLoginBodySchema = loginBodySchema;

export const adminLoginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email, mobile, or Employee ID is required')
    .max(255),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpBodySchema = z.object({
  mobile: indianMobileSchema,
  otp: otpSchema,
  purpose: otpPurposeSchema,
  otpChallenge: z.string().min(1).optional(),
});

export const sendOtpBodySchema = z.object({
  mobile: indianMobileSchema,
  purpose: otpPurposeSchema,
  otpChallenge: z.string().min(1).optional(),
});

export const forgotPasswordBodySchema = z.object({
  mobile: indianMobileSchema,
});

/** Admin portal: Employee ID or registered mobile. */
export const adminForgotPasswordBodySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Employee ID or registered mobile is required')
    .max(64),
});

export const resetPasswordBodySchema = z.object({
  mobile: indianMobileSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

/** Admin portal reset — same shape as customer reset; staff-only on the server. */
export const adminResetPasswordBodySchema = resetPasswordBodySchema;

export const adminVerifyResetOtpBodySchema = z.object({
  mobile: indianMobileSchema,
  otp: otpSchema,
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const completeRegistrationBodySchema = z.object({
  registrationToken: z.string().min(1, 'Registration token is required'),
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD')
    .optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
});

export const refreshTokenBodySchema = z.object({
  // Optional when the HttpOnly refresh cookie is present.
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type DealerLoginBody = z.infer<typeof dealerLoginBodySchema>;
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;
export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type AdminForgotPasswordBody = z.infer<typeof adminForgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type AdminResetPasswordBody = z.infer<typeof adminResetPasswordBodySchema>;
export type AdminVerifyResetOtpBody = z.infer<typeof adminVerifyResetOtpBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type CompleteRegistrationBody = z.infer<typeof completeRegistrationBodySchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
