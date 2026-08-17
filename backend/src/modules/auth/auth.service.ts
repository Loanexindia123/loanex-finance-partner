import { OtpPurpose, UserStatus } from '@prisma/client';
import { env } from '../../config/env';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors/app-error';
import {
  getRefreshExpiryDate,
  hashToken,
  signAccessToken,
  signOtpChallenge,
  signRefreshToken,
  signRegistrationToken,
  verifyOtpChallenge,
  verifyRefreshToken,
  verifyRegistrationToken,
} from '../../common/utils/jwt';
import { comparePassword, hashPassword } from '../../common/utils/password';
import { generateOtp, getOtpExpiryDate } from '../../common/utils/otp';
import {
  AdminLoginBody,
  AdminForgotPasswordBody,
  AdminResetPasswordBody,
  AdminVerifyResetOtpBody,
  ChangePasswordBody,
  CompleteRegistrationBody,
  ForgotPasswordBody,
  LoginBody,
  LogoutBody,
  RefreshTokenBody,
  RegisterBody,
  ResetPasswordBody,
  SendOtpBody,
  VerifyOtpBody,
} from './auth.dto';
import { authkeySmsService } from '../../common/services/authkey-sms.service';
import { authRepository } from './auth.repository';
import { jsonDb } from '../../config/json-db';
import { auditLogService } from '../verification/service/audit-log.service';
import { effectivePermissionsForRole, SUPER_ADMIN_PERMISSIONS } from '../rbac/permissions';

/**
 * Enrich a user row with RBAC role info (roleId / roleName / permissions).
 * Legacy admins WITHOUT a role_id fall back to full Super Admin access so
 * existing admin accounts are never locked out.
 * Security: if role_id is set but the role cannot be found, we DENY ([]) —
 * never escalate to Super Admin.
 */
function resolveRbacInfo(user: any) {
  const roleId = user?.role_id ?? user?.roleId ?? null;
  if (roleId) {
    const role = jsonDb.findOne('roles', { id: roleId });
    if (role) {
      return { roleId, roleName: role.name, permissions: effectivePermissionsForRole(role) };
    }
    return { roleId, roleName: null, permissions: [] };
  }
  if (String(user?.role ?? '') === 'admin') {
    return { roleId: null, roleName: 'Super Admin', permissions: [...SUPER_ADMIN_PERMISSIONS] };
  }
  return { roleId: null, roleName: null, permissions: [] };
}

/** Staff portal accounts only — excludes customers / app-only users. */
function isStaffAccount(user: any): boolean {
  if (!user) return false;
  return String(user.role ?? '') === 'admin' || Boolean(user.role_id ?? user.roleId);
}

function maskMobile(mobile: string): string {
  const digits = String(mobile ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

/**
 * Same as resolveRbacInfo but async — also re-reads the roles collection from
 * MongoDB when a role is not yet cached locally (role created on another
 * serverless instance).
 */
async function resolveLoginRbacInfo(user: any) {
  const roleId = user?.role_id ?? user?.roleId ?? null;
  if (roleId) {
    let role = jsonDb.findOne('roles', { id: roleId });
    if (!role) {
      try {
        await jsonDb.refreshCollection('roles');
        role = jsonDb.findOne('roles', { id: roleId });
      } catch {
        /* keep local state */
      }
    }
    if (role) {
      return { roleId, roleName: role.name, permissions: effectivePermissionsForRole(role) };
    }
    return { roleId, roleName: null, permissions: [] };
  }
  if (String(user?.role ?? '') === 'admin') {
    return { roleId: null, roleName: 'Super Admin', permissions: [...SUPER_ADMIN_PERMISSIONS] };
  }
  return { roleId: null, roleName: null, permissions: [] };
}

function resolveStatus(user: any): string {
  const raw = String(user?.status ?? '').toUpperCase();
  if (raw === UserStatus.BLOCKED || raw === 'BLOCKED') return UserStatus.BLOCKED;
  if (raw === UserStatus.PENDING || raw === 'PENDING') return UserStatus.PENDING;
  if (raw === UserStatus.ACTIVE || raw === 'ACTIVE') return UserStatus.ACTIVE;
  // Explicit mobile verification flags.
  if (user?.mobileVerified === true || user?.mobile_verified === true) {
    return UserStatus.ACTIVE;
  }
  if (user?.mobileVerified === false || user?.mobile_verified === false) {
    return UserStatus.PENDING;
  }
  // Legacy Supabase rows created before status/mobileVerified columns existed:
  // a stored password hash implies registration completed (OTP-first flow).
  const hash = user?.encryptedPassword ?? user?.password ?? '';
  if (typeof hash === 'string' && hash.startsWith('$2')) {
    return UserStatus.ACTIVE;
  }
  return UserStatus.PENDING;
}

function isMobileVerified(user: any): boolean {
  if (user?.mobileVerified === true || user?.mobile_verified === true) return true;
  if (user?.mobileVerified === false || user?.mobile_verified === false) return false;
  return resolveStatus(user) === UserStatus.ACTIVE;
}

function toPublicUser(user: any) {
  const profileName = user.profiles?.fullName?.trim();
  const userName = typeof user.fullName === 'string' ? user.fullName.trim() : '';
  const fullName = profileName || userName || '';

  const profileEmail = user.profiles?.email?.trim() || '';
  const userEmail = user.email?.trim() || '';
  const emailCandidate = profileEmail || userEmail;
  const email =
    emailCandidate && !emailCandidate.toLowerCase().endsWith('@loanex.in')
      ? emailCandidate
      : '';

  const status = resolveStatus(user);
  const mobileVerified = isMobileVerified(user);
  const rbac = resolveRbacInfo(user);

  return {
    id: user.id,
    uuid: user.id,
    fullName: fullName || (user.phone ? `User ${user.phone}` : 'User'),
    mobile: user.phone ?? user.profiles?.mobile_number ?? user.profiles?.mobileNumber ?? '',
    email,
    isMobileVerified: mobileVerified,
    isEmailVerified: Boolean(email),
    status,
    roleId: rbac.roleId,
    roleName: rbac.roleName,
    permissions: rbac.permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt ?? user.created_at ?? new Date(),
    updatedAt: user.updatedAt ?? user.updated_at ?? new Date(),
  };
}

export class AuthService {
  async getMe(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return { user: toPublicUser(user) };
  }

  /**
   * Legacy register: creates PENDING user, sends Authkey OTP.
   * Prefer OTP-first flow (send-otp REGISTER → verify → complete-registration).
   * Never returns JWT or OTP value.
   */
  async register(input: RegisterBody) {
    const existingEmail = await authRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const existingMobile = await authRepository.findByMobile(input.mobile);
    if (existingMobile) {
      throw new ConflictError('An account with this mobile number already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      password: passwordHash,
      status: UserStatus.PENDING,
      mobileVerified: false,
    });

    await this.sendAuthkeyOtp(user.phone ?? input.mobile, OtpPurpose.REGISTER, user.id);

    return {
      user: toPublicUser(user),
      otpSent: true,
      message: 'Account created. Please verify the OTP sent to your mobile.',
    };
  }

  /**
   * Password login only. No login OTP. No JWT until ACTIVE + mobileVerified.
   */
  async login(input: LoginBody) {
    const user = await authRepository.findByIdentifier(input.identifier);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const passwordHash = user.encryptedPassword ?? user.password ?? '';
    if (!passwordHash) {
      throw new UnauthorizedError(
        'No password set for this account. Please reset your password.',
        { code: 'PASSWORD_NOT_SET' as const, requiresOtp: true, resetFlow: true },
      );
    }

    let valid = false;
    try {
      valid = await comparePassword(input.password, passwordHash);
    } catch {
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const status = resolveStatus(user);
    if (status === UserStatus.BLOCKED) {
      throw new ForbiddenError('Your account has been blocked. Contact support.');
    }

    if (status === UserStatus.PENDING || !isMobileVerified(user)) {
      throw new ForbiddenError(
        'Mobile number not verified. Please complete OTP verification before logging in.',
        { code: 'MOBILE_NOT_VERIFIED', requiresOtp: true },
      );
    }

    const tokens = await this.issueTokenPair(user);

    return {
      requiresOtp: false as const,
      user: toPublicUser(user),
      ...tokens,
      message: 'Login successful',
    };
  }

  async adminLogin(
    input: AdminLoginBody,
    context: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const user = await authRepository.findByIdentifier(input.email);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Staff = legacy `admin` role OR explicitly assigned a role_id.
    const rbac = await resolveLoginRbacInfo(user);
    const isStaff =
      String(user.role ?? '') === 'admin' || Boolean(user.role_id ?? user.roleId ?? rbac.roleId);
    if (!isStaff) {
      throw new ForbiddenError('Access denied: only admin users can log in to the admin portal');
    }

    const passwordHash = user.encryptedPassword ?? user.password ?? '';
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await comparePassword(input.password, passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Blocked staff accounts must not be able to sign in to the admin portal
    // (checked after credential validation to avoid leaking account state).
    if (resolveStatus(user) === UserStatus.BLOCKED) {
      // Security trail: log the rejected attempt so repeated blocked-account
      // sign-ins are visible in the user's activity feed.
      void auditLogService.log({
        userId: user.id,
        action: 'ADMIN_LOGIN_BLOCKED',
        entity: 'auth',
        metadata: {
          email: user.email ?? '',
          ipAddress: context.ipAddress ?? '',
          userAgent: context.userAgent ?? '',
          timestamp: new Date().toISOString(),
        },
      });
      throw new ForbiddenError('Your account has been blocked. Contact support.');
    }

    const token = signAccessToken({
      sub: user.id,
      uuid: user.id,
      email: user.email ?? `${user.phone ?? ''}@loanex.in`,
      mobile: user.phone ?? '',
    });

    void auditLogService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'auth',
      metadata: {
        ipAddress: context.ipAddress ?? '',
        userAgent: context.userAgent ?? '',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone ?? '',
        email: user.email ?? '',
        role: 'admin',
        roleId: rbac.roleId,
        roleName: rbac.roleName,
        permissions: rbac.permissions,
        mustChangePassword: Boolean(user.mustChangePassword),
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      message: 'Admin login successful',
    };
  }

  async sendOtp(input: SendOtpBody) {
    const mobile = input.mobile.trim();
    const purpose = (input.purpose as OtpPurpose) || OtpPurpose.REGISTER;

    if (purpose === OtpPurpose.LOGIN) {
      throw new BadRequestError(
        'Login OTP is disabled. Please sign in with your password.',
        { code: 'LOGIN_OTP_DISABLED' },
      );
    }

    const user = await authRepository.findByMobile(mobile);

    if (purpose === OtpPurpose.REGISTER && user && isMobileVerified(user)) {
      throw new ConflictError('An account with this mobile number already exists. Please log in.');
    }

    if (purpose === OtpPurpose.FORGOT_PASSWORD && !user) {
      throw new BadRequestError(
        'No account found for this mobile number. Please create an account.',
      );
    }

    if (purpose === OtpPurpose.REGISTER) {
      return this.sendRegistrationOtp(mobile, input.otpChallenge);
    }

    if (purpose === OtpPurpose.FORGOT_PASSWORD) {
      await this.sendAuthkeyOtp(mobile, OtpPurpose.FORGOT_PASSWORD, user?.id);
      return {
        otpSent: true,
        mobile,
        purpose,
        expiresInMinutes: env.OTP_EXPIRES_MINUTES,
        resendCooldownIn: env.OTP_RESEND_COOLDOWN_SECONDS,
        message: 'OTP sent successfully.',
      };
    }

    throw new BadRequestError('Unsupported OTP purpose.');
  }

  async verifyOtp(input: VerifyOtpBody) {
    const mobile = input.mobile.trim();
    const purpose = (input.purpose as OtpPurpose) || OtpPurpose.REGISTER;

    if (purpose === OtpPurpose.LOGIN) {
      throw new BadRequestError(
        'Login OTP is disabled. Please sign in with your password.',
        { code: 'LOGIN_OTP_DISABLED' },
      );
    }

    if (purpose === OtpPurpose.REGISTER) {
      await this.verifyAuthkeyOtp(mobile, input.otp, OtpPurpose.REGISTER, input.otpChallenge);
      const existing = await authRepository.findByMobile(mobile);
      if (existing) {
        // Legacy register path: activate PENDING user after OTP.
        if (resolveStatus(existing) === UserStatus.PENDING || !isMobileVerified(existing)) {
          const activated = await authRepository.activateUser(existing.id);
          const tokens = await this.issueTokenPair(activated);
          return {
            verified: true,
            activated: true,
            requiresProfile: false as const,
            user: toPublicUser(activated),
            ...tokens,
            message: 'Mobile verified. You are now logged in.',
          };
        }
        throw new ConflictError(
          'An account with this mobile number already exists. Please log in.',
        );
      }
      return {
        verified: true,
        activated: false,
        requiresProfile: true as const,
        mobile,
        registrationToken: signRegistrationToken(mobile),
        message: 'Mobile verified. Please complete your profile.',
      };
    }

    if (purpose === OtpPurpose.FORGOT_PASSWORD || purpose === OtpPurpose.RESET_PASSWORD) {
      // Do NOT consume the OTP here: the subsequent reset-password step still
      // needs to validate the same code. It is marked used only when the new
      // password is actually set (see resetPassword).
      await this.verifyAuthkeyOtp(
        mobile,
        input.otp,
        OtpPurpose.FORGOT_PASSWORD,
        undefined,
        false,
      );
      return {
        verified: true,
        activated: false,
        requiresProfile: false as const,
        mobile,
        message: 'OTP verified. You may reset your password.',
      };
    }

    throw new BadRequestError('Unsupported OTP purpose.');
  }

  private async sendRegistrationOtp(mobile: string, previousChallenge?: string) {
    if (env.NODE_ENV === 'production' && !authkeySmsService.isConfigured()) {
      throw new BadRequestError('OTP service is not configured. Please contact support.');
    }

    let resendCount = 1;
    if (previousChallenge) {
      try {
        const prev = verifyOtpChallenge(previousChallenge);
        if (prev.mobile === mobile && prev.purpose === OtpPurpose.REGISTER) {
          const elapsedMs = Date.now() - Number(prev.lastSentAt || 0);
          const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
          if (elapsedMs < cooldownMs) {
            const wait = Math.ceil((cooldownMs - elapsedMs) / 1000);
            throw new BadRequestError(
              `Please wait ${wait} seconds before requesting another OTP.`,
            );
          }
          if (Number(prev.resendCount ?? 1) >= env.OTP_MAX_RESEND) {
            throw new BadRequestError(
              'Maximum OTP resend limit reached. Please try again after some time.',
            );
          }
          resendCount = Number(prev.resendCount ?? 1) + 1;
        }
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        resendCount = 1;
      }
    } else {
      const existing = await authRepository.findLatestOtp(mobile, OtpPurpose.REGISTER);
      if (existing?.lastSentAt) {
        const elapsedMs = Date.now() - existing.lastSentAt.getTime();
        const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
        if (elapsedMs < cooldownMs) {
          const wait = Math.ceil((cooldownMs - elapsedMs) / 1000);
          throw new BadRequestError(
            `Please wait ${wait} seconds before requesting another OTP.`,
          );
        }
        if (Number(existing.resendCount ?? 1) >= env.OTP_MAX_RESEND) {
          throw new BadRequestError(
            'Maximum OTP resend limit reached. Please try again after some time.',
          );
        }
        resendCount = Number(existing.resendCount ?? 1) + 1;
      }
    }

    const { otpChallenge } = await this.sendAuthkeyOtp(
      mobile,
      OtpPurpose.REGISTER,
      undefined,
      resendCount,
    );

    return {
      otpSent: true,
      mobile,
      purpose: OtpPurpose.REGISTER,
      expiresInMinutes: env.OTP_EXPIRES_MINUTES,
      resendAvailableIn: env.OTP_RESEND_COOLDOWN_SECONDS,
      maxResend: env.OTP_MAX_RESEND,
      resendCount,
      otpChallenge,
      message: 'OTP sent successfully to your mobile number.',
    };
  }

  private async verifyAuthkeyOtp(
    mobile: string,
    otp: string,
    purpose: OtpPurpose,
    otpChallenge?: string,
    consume = true,
  ) {
    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestError('OTP must be a 6-digit code.');
    }

    let challenge: ReturnType<typeof verifyOtpChallenge> | null = null;
    if (otpChallenge) {
      try {
        challenge = verifyOtpChallenge(otpChallenge);
      } catch {
        throw new BadRequestError('OTP session expired. Please request a new OTP.');
      }
      if (challenge.mobile !== mobile || challenge.purpose !== purpose) {
        throw new BadRequestError('Invalid OTP session. Please request a new OTP.');
      }
    }

    const record = await authRepository.findLatestOtp(mobile, purpose);
    const otpHash = challenge?.otpHash ?? record?.otpHash;
    const attempts = challenge?.attempts ?? Number(record?.attempts ?? 0);
    const expiresAt = record?.expiresAt;

    if (!otpHash) {
      throw new BadRequestError('OTP not found or already used. Please request a new OTP.');
    }

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      if (record) await authRepository.markOtpUsed(record.id);
      throw new BadRequestError('OTP has expired. Please request a new OTP.');
    }

    if (attempts >= env.OTP_MAX_ATTEMPTS) {
      if (record) await authRepository.markOtpUsed(record.id);
      throw new BadRequestError('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    const submittedHash = hashToken(otp);
    if (otpHash !== submittedHash) {
      const nextAttempts = attempts + 1;
      if (record) await authRepository.incrementOtpAttempts(record.id);
      const left = env.OTP_MAX_ATTEMPTS - nextAttempts;
      const details =
        challenge
          ? {
              otpChallenge: signOtpChallenge({
                mobile: challenge.mobile,
                purpose: challenge.purpose,
                otpHash: challenge.otpHash,
                attempts: nextAttempts,
                resendCount: challenge.resendCount,
                lastSentAt: challenge.lastSentAt,
              }),
            }
          : undefined;
      throw new BadRequestError(
        left > 0
          ? `Invalid OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Invalid OTP. Maximum attempts exceeded.',
        details,
      );
    }

    if (consume) {
      if (record) await authRepository.markOtpUsed(record.id);
      await authRepository.invalidateOtps(mobile, purpose);
    }
  }

  async completeRegistration(input: CompleteRegistrationBody) {
    let mobile: string;
    try {
      mobile = verifyRegistrationToken(input.registrationToken).mobile;
    } catch {
      throw new UnauthorizedError('Registration session expired. Please verify your mobile again.');
    }

    const existingMobile = await authRepository.findByMobile(mobile);
    if (existingMobile) {
      throw new ConflictError('An account with this mobile number already exists');
    }

    const existingEmail = await authRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      fullName: input.fullName,
      email: input.email,
      mobile,
      password: passwordHash,
      status: UserStatus.ACTIVE,
      mobileVerified: true,
      dob: input.dob,
      gender: input.gender,
    });

    const tokens = await this.issueTokenPair(user);

    return {
      requiresOtp: false as const,
      user: toPublicUser(user),
      ...tokens,
      message: 'Account created successfully',
    };
  }

  async forgotPassword(input: ForgotPasswordBody) {
    const user = await authRepository.findByMobile(input.mobile);
    if (!user) {
      throw new BadRequestError('No account found for this mobile number');
    }

    await this.sendAuthkeyOtp(input.mobile, OtpPurpose.FORGOT_PASSWORD, user.id);

    return {
      otpSent: true,
      mobile: input.mobile,
      message: 'OTP sent for password reset',
    };
  }

  /**
   * Admin/Employee forgot password — reuses the existing Authkey OTP pipeline.
   * Only staff accounts (role admin or assigned role_id) are eligible.
   * Customers are ignored with a generic response (no enumeration).
   */
  async adminForgotPassword(input: AdminForgotPasswordBody) {
    const genericMessage =
      'If an eligible staff account matches, an OTP has been sent to the registered mobile number.';

    const resolved = await this.resolveStaffUserForPasswordReset(input.identifier);
    if (!resolved?.mobile) {
      return {
        otpSent: false,
        mobile: '',
        mobileMasked: '',
        expiresInMinutes: env.OTP_EXPIRES_MINUTES,
        resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
        message: genericMessage,
      };
    }

    await this.sendAuthkeyOtp(resolved.mobile, OtpPurpose.FORGOT_PASSWORD, resolved.user.id);

    return {
      otpSent: true,
      mobile: resolved.mobile,
      mobileMasked: maskMobile(resolved.mobile),
      expiresInMinutes: env.OTP_EXPIRES_MINUTES,
      resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      message: genericMessage,
    };
  }

  /** Verify OTP for admin reset without consuming it (same as existing FORGOT_PASSWORD verify). */
  async adminVerifyResetOtp(input: AdminVerifyResetOtpBody) {
    const user = await authRepository.findByMobile(input.mobile);
    if (!user || !isStaffAccount(user)) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    const otpHash = hashToken(input.otp);
    const otpRecord = await authRepository.findValidOtp(
      input.mobile,
      OtpPurpose.FORGOT_PASSWORD,
      otpHash,
    );
    if (!otpRecord) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    return {
      verified: true,
      mobile: input.mobile,
      message: 'OTP verified. You may reset your password.',
    };
  }

  /** Staff-only password reset using the existing OTP records. */
  async adminResetPassword(input: AdminResetPasswordBody) {
    if (!/^\d{6}$/.test(input.otp)) {
      throw new BadRequestError('OTP must be a 6-digit code.');
    }

    const otpHash = hashToken(input.otp);
    const record = await authRepository.findValidOtp(
      input.mobile,
      OtpPurpose.FORGOT_PASSWORD,
      otpHash,
    );
    const otpRecord =
      record ??
      (await authRepository.findValidOtp(input.mobile, OtpPurpose.RESET_PASSWORD, otpHash));

    if (!otpRecord) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    const user = await authRepository.findByMobile(input.mobile);
    if (!user || !isStaffAccount(user)) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.updateUser(user.id, {
      encryptedPassword: passwordHash,
      mustChangePassword: false,
    });
    await authRepository.markOtpUsed(otpRecord.id);
    await authRepository.invalidateOtps(input.mobile, OtpPurpose.FORGOT_PASSWORD);
    await authRepository.deleteUserRefreshTokens(user.id);

    return {
      reset: true,
      message: 'Password reset successfully.',
    };
  }

  async resetPassword(input: ResetPasswordBody) {
    if (!/^\d{6}$/.test(input.otp)) {
      throw new BadRequestError('OTP must be a 6-digit code.');
    }

    const otpHash = hashToken(input.otp);
    const record = await authRepository.findValidOtp(
      input.mobile,
      OtpPurpose.FORGOT_PASSWORD,
      otpHash,
    );

    const otpRecord =
      record ??
      (await authRepository.findValidOtp(
        input.mobile,
        OtpPurpose.RESET_PASSWORD,
        otpHash,
      ));

    if (!otpRecord) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    const user = await authRepository.findByMobile(input.mobile);
    if (!user) {
      throw new BadRequestError('User not found');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.updateUser(user.id, {
      encryptedPassword: passwordHash,
      mustChangePassword: false,
    });
    await authRepository.markOtpUsed(otpRecord.id);
    await authRepository.invalidateOtps(input.mobile, OtpPurpose.FORGOT_PASSWORD);
    await authRepository.deleteUserRefreshTokens(user.id);

    return {
      reset: true,
      message: 'Password reset successful. Please log in with your new password.',
    };
  }

  /**
   * Resolve a staff portal user from Employee ID or registered mobile.
   * Customers / non-staff matches return null (caller uses generic messaging).
   */
  private async resolveStaffUserForPasswordReset(
    identifier: string,
  ): Promise<{ user: any; mobile: string } | null> {
    const raw = String(identifier ?? '').trim();
    if (!raw) return null;

    const mobileCandidate = raw.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(mobileCandidate)) {
      const user = await authRepository.findByMobile(mobileCandidate);
      if (!user || !isStaffAccount(user)) return null;
      const mobile = String(user.phone ?? mobileCandidate).trim();
      return mobile ? { user, mobile } : null;
    }

    // Employee ID path — Employee Master → linked user / mobile.
    await jsonDb.ensureCollection('employees');
    const codeKey = raw.toLowerCase();
    const employees = jsonDb.findMany('employees', {}) as any[];
    const employee = employees.find(
      (row) => String(row.employeeId ?? '').trim().toLowerCase() === codeKey,
    );
    if (!employee) return null;

    let user: any = null;
    const linkedUserId = String(employee.userId ?? '').trim();
    if (linkedUserId) {
      user = await authRepository.findById(linkedUserId);
    }
    const empMobile = String(employee.mobile ?? '')
      .replace(/\D/g, '')
      .trim();
    if (!user && /^[6-9]\d{9}$/.test(empMobile)) {
      user = await authRepository.findByMobile(empMobile);
    }
    const empEmail = String(employee.email ?? '')
      .trim()
      .toLowerCase();
    if (!user && empEmail) {
      user = await authRepository.findByEmail(empEmail);
    }
    if (!user || !isStaffAccount(user)) return null;

    const mobile =
      String(user.phone ?? '')
        .replace(/\D/g, '')
        .trim() || empMobile;
    if (!/^[6-9]\d{9}$/.test(mobile)) return null;
    return { user, mobile };
  }

  async changePassword(userId: string, input: ChangePasswordBody) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const passwordHash = user.encryptedPassword ?? user.password ?? '';
    if (!passwordHash) {
      throw new BadRequestError(
        'No password set for this account. Please reset your password.',
        { code: 'PASSWORD_NOT_SET' as const, requiresOtp: true, resetFlow: true },
      );
    }

    let valid = false;
    try {
      valid = await comparePassword(input.currentPassword, passwordHash);
    } catch {
      throw new BadRequestError('Current password is incorrect');
    }
    if (!valid) {
      throw new BadRequestError('Current password is incorrect');
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestError('New password must be different from the current password');
    }

    const newPasswordHash = await hashPassword(input.newPassword);
    await authRepository.updateUser(user.id, {
      encryptedPassword: newPasswordHash,
      mustChangePassword: false,
    });
    await authRepository.deleteUserRefreshTokens(user.id);

    return {
      changed: true,
      mustChangePassword: false,
      message: 'Password changed successfully. Please log in again with your new password.',
    };
  }

  async refreshToken(input: RefreshTokenBody) {
    let payload;
    try {
      payload = verifyRefreshToken(input.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(input.refreshToken);
    const stored = await authRepository.findRefreshToken(tokenHash);

    if (!stored) {
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }

    if (resolveStatus(stored.user) === UserStatus.BLOCKED) {
      throw new ForbiddenError('Your account has been blocked');
    }

    if (resolveStatus(stored.user) !== UserStatus.ACTIVE || !isMobileVerified(stored.user)) {
      throw new ForbiddenError('Mobile number not verified.');
    }

    await authRepository.deleteRefreshToken(tokenHash);
    const tokens = await this.issueTokenPair(stored.user);

    return {
      user: toPublicUser(stored.user),
      ...tokens,
      message: 'Token refreshed',
    };
  }

  async logout(input: LogoutBody) {
    const tokenHash = hashToken(input.refreshToken);
    await authRepository.deleteRefreshToken(tokenHash);
    return { loggedOut: true, message: 'Logged out successfully' };
  }

  /**
   * Generate OTP, store hash, send via Authkey. Never returns or logs OTP.
   */
  private async sendAuthkeyOtp(
    mobile: string,
    purpose: OtpPurpose,
    userId?: string,
    resendCount = 1,
  ): Promise<{ otpChallenge: string }> {
    if (!authkeySmsService.isConfigured()) {
      if (env.NODE_ENV === 'production') {
        throw new BadRequestError('OTP service is not configured. Please contact support.');
      }
      throw new BadRequestError(
        'AUTHKEY_API_KEY is not configured. Cannot send OTP.',
      );
    }

    await authRepository.invalidateOtps(mobile, purpose);

    const otp = generateOtp(env.OTP_LENGTH);
    const expiresAt = getOtpExpiryDate(env.OTP_EXPIRES_MINUTES);
    const otpHash = hashToken(otp);
    const lastSentAt = Date.now();

    await authRepository.createOtp({
      mobile,
      otp: otpHash,
      purpose,
      expiresAt,
      resendCount,
      ...(userId ? { userId } : {}),
    });

    try {
      await authkeySmsService.sendOtpSms(mobile, otp);
    } catch (err) {
      throw new BadRequestError(
        err instanceof Error ? err.message : 'Failed to send OTP SMS. Please try again.',
      );
    }

    const otpChallenge = signOtpChallenge({
      mobile,
      purpose,
      otpHash,
      attempts: 0,
      resendCount,
      lastSentAt,
    });

    return { otpChallenge };
  }

  private async issueTokenPair(user: any) {
    const accessToken = signAccessToken({
      sub: user.id,
      uuid: user.id,
      email: user.email ?? `${user.phone}@loanex.in`,
      mobile: user.phone ?? user.mobile ?? '',
    });

    const { token: refreshToken } = signRefreshToken({
      sub: user.id,
      uuid: user.id,
    });

    await authRepository.createRefreshToken({
      token: hashToken(refreshToken),
      expiresAt: getRefreshExpiryDate(),
      user: { connect: { id: user.id } },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }
}

export const authService = new AuthService();
