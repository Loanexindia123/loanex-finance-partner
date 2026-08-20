import { v4 as uuidv4 } from 'uuid';
import { jsonDb } from '../../config/json-db';
import { getMongoDb, isMongoConfigured } from '../../config/mongo';

/**
 * Customer (and shared) auth persistence.
 *
 * MongoDB `users` / `profiles` are the ONLY durable source of truth for
 * authentication lookups and registration. In-memory jsonDb and Supabase are
 * not consulted for user credential reads.
 *
 * OTP helpers still use jsonDb (ephemeral). Refresh tokens still persist via
 * jsonDb.insertAwaited, which writes durably to MongoDB.
 */
export class AuthRepository {
  private assertMongoForAuth(): void {
    if (!isMongoConfigured()) {
      throw new Error('MongoDB is required for authentication');
    }
  }

  private stripMongoId<T extends Record<string, any>>(row: T | null | undefined): T | null {
    if (!row) return null;
    const { _id, ...rest } = row as T & { _id?: unknown };
    if ((rest as any).id == null && _id != null) {
      (rest as any).id = String(_id);
    }
    return rest as T;
  }

  /**
   * Best-effort mirror into process memory for non-auth modules that still
   * read jsonDb. Auth itself never treats this cache as authoritative.
   */
  private seedLocalCache(collectionName: 'users' | 'profiles', row: any): void {
    if (!row?.id) return;
    try {
      const collection = jsonDb.getCollection(collectionName);
      const idx = collection.findIndex((item: any) => item.id === row.id);
      const clean = this.stripMongoId({ ...row }) as any;
      if (idx === -1) {
        collection.push(clean);
      } else {
        collection[idx] = { ...collection[idx], ...clean };
      }
    } catch {
      /* non-auth cache only */
    }
  }

  private async formatUserWithProfile(user: any) {
    if (!user) return null;
    this.assertMongoForAuth();
    const db = await getMongoDb();
    const profileDoc = await db.collection('profiles').findOne({
      $or: [{ id: user.id }, { _id: user.id as any }],
    });
    const profile = this.stripMongoId(profileDoc as any);
    if (profile) this.seedLocalCache('profiles', profile);
    return {
      ...user,
      profiles: profile || null,
    };
  }

  /**
   * Prefer the row that carries a password hash when duplicates share a phone/email.
   */
  private pickBestUserMatch(rows: any[]): any | null {
    if (!rows || rows.length === 0) return null;
    const hasPassword = (u: any) => {
      const hash = u?.encryptedPassword ?? u?.password ?? '';
      return typeof hash === 'string' && hash.length > 0;
    };
    const withPassword = rows.filter(hasPassword);
    const pool = withPassword.length > 0 ? withPassword : rows;
    return pool.sort((a, b) => {
      const ta = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    })[0];
  }

  private async findUsersInMongo(filter: Record<string, unknown>): Promise<any[]> {
    this.assertMongoForAuth();
    const db = await getMongoDb();
    const docs = await db.collection('users').find(filter).limit(20).toArray();
    return docs
      .map((doc) => this.stripMongoId(doc as any))
      .filter(Boolean) as any[];
  }

  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await this.findUsersInMongo({ email: normalized });
    const user = this.pickBestUserMatch(rows);
    return this.formatUserWithProfile(user);
  }

  async findByMobile(mobile: string) {
    const phone = mobile.trim();
    const rows = await this.findUsersInMongo({ phone });
    const user = this.pickBestUserMatch(rows);
    return this.formatUserWithProfile(user);
  }

  async findById(id: string) {
    const rows = await this.findUsersInMongo({
      $or: [{ id }, { _id: id as any }],
    } as any);
    const user = this.pickBestUserMatch(rows);
    return this.formatUserWithProfile(user);
  }

  async findByUuid(uuid: string) {
    return this.findById(uuid);
  }

  async findByIdentifier(identifier: string) {
    const isMobile = /^[6-9]\d{9}$/.test(identifier.trim());
    if (isMobile) {
      return this.findByMobile(identifier.trim());
    }
    return this.findByEmail(identifier.trim().toLowerCase());
  }

  /** Staff login code stored on the user row (Employee ID). Not used for customer login. */
  async findByEmployeeId(employeeId: string) {
    const code = employeeId.trim();
    if (!code) return null;
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await this.findUsersInMongo({
      $or: [
        { employeeId: { $regex: `^${escaped}$`, $options: 'i' } },
        { employee_code: { $regex: `^${escaped}$`, $options: 'i' } },
      ],
    } as any);
    const user = this.pickBestUserMatch(rows);
    return this.formatUserWithProfile(user);
  }

  async createUser(data: {
    fullName: string;
    email: string;
    mobile: string;
    password?: string;
    status?: any;
    mobileVerified?: boolean;
    dob?: string;
    gender?: string;
  }): Promise<any> {
    this.assertMongoForAuth();
    const id = uuidv4();
    const now = new Date().toISOString();
    const status = data.status ?? 'PENDING';
    const mobileVerified =
      data.mobileVerified ?? String(status).toUpperCase() === 'ACTIVE';
    const email = String(data.email ?? '')
      .trim()
      .toLowerCase();
    // `data.password` is expected to already be a bcrypt hash from AuthService.
    const passwordHash = data.password ?? '';

    const userDoc: Record<string, any> = {
      _id: id,
      id,
      phone: data.mobile,
      email,
      encryptedPassword: passwordHash,
      role: 'authenticated',
      status,
      mobileVerified,
      mobile_verified: mobileVerified,
      created_at: now,
      updated_at: now,
      createdAt: now,
      updatedAt: now,
    };

    const profileDoc: Record<string, any> = {
      _id: id,
      id,
      mobile_number: data.mobile,
      fullName: data.fullName,
      email,
      ...(data.dob ? { dob: data.dob } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
      created_at: now,
      updated_at: now,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getMongoDb();
    await db.collection('users').replaceOne({ _id: id as any }, userDoc, { upsert: true });
    await db.collection('profiles').replaceOne({ _id: id as any }, profileDoc, { upsert: true });

    const user = this.stripMongoId(userDoc)!;
    const profile = this.stripMongoId(profileDoc)!;
    this.seedLocalCache('users', user);
    this.seedLocalCache('profiles', profile);

    return { ...user, profiles: profile };
  }

  async updateUser(id: string, data: any) {
    this.assertMongoForAuth();
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const { profiles: _profiles, _id: _ignored, ...restExisting } = existing as any;
    const updatePayload = {
      ...data,
      updatedAt: now,
      updated_at: now,
    };

    const db = await getMongoDb();
    await db.collection('users').updateOne(
      { $or: [{ id }, { _id: id as any }] },
      { $set: updatePayload },
    );

    const updated = this.stripMongoId({
      ...restExisting,
      ...updatePayload,
      id,
    });
    if (updated) this.seedLocalCache('users', updated);
    return this.formatUserWithProfile(updated);
  }

  async activateUser(id: string) {
    const now = new Date().toISOString();
    return this.updateUser(id, {
      status: 'ACTIVE',
      mobileVerified: true,
      mobile_verified: true,
      updatedAt: now,
      updated_at: now,
    });
  }

  async invalidateOtps(mobile: string, purpose: any) {
    const all = jsonDb.findMany('otps');
    for (const row of all) {
      if (row.mobile === mobile && String(row.purpose) === String(purpose) && !row.used) {
        jsonDb.update('otps', { id: row.id }, { used: true, invalidated: true });
      }
    }
  }

  async createOtp(data: {
    mobile: string;
    otp: string;
    purpose: any;
    expiresAt: Date;
    resendCount?: number;
    userId?: string;
  }) {
    return jsonDb.insert('otps', {
      mobile: data.mobile,
      purpose: String(data.purpose),
      otpHash: data.otp,
      expiresAt:
        data.expiresAt instanceof Date
          ? data.expiresAt.toISOString()
          : data.expiresAt,
      attempts: 0,
      resendCount: data.resendCount ?? 1,
      lastSentAt: new Date().toISOString(),
      used: false,
      invalidated: false,
      ...(data.userId ? { userId: data.userId } : {}),
    });
  }

  async findLatestOtp(mobile: string, purpose: any) {
    const rows = jsonDb
      .findMany('otps')
      .filter(
        (r: any) =>
          r.mobile === mobile &&
          String(r.purpose) === String(purpose) &&
          !r.used &&
          !r.invalidated,
      )
      .sort((a: any, b: any) => {
        const ta = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0;
        const tb = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0;
        return tb - ta;
      });
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      expiresAt: new Date(row.expiresAt),
      lastSentAt: row.lastSentAt ? new Date(row.lastSentAt) : null,
    };
  }

  async findValidOtp(mobile: string, purpose: any, otpHash: string) {
    const row = await this.findLatestOtp(mobile, purpose);
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    if (row.otpHash !== otpHash) return null;
    return row;
  }

  async incrementOtpAttempts(id: string) {
    const row = jsonDb.findOne('otps', { id });
    if (!row) return null;
    return jsonDb.update('otps', { id }, { attempts: Number(row.attempts ?? 0) + 1 });
  }

  async markOtpUsed(id: string) {
    jsonDb.update('otps', { id }, { used: true });
  }

  async createRefreshToken(data: any) {
    const userId = data?.user?.connect?.id;
    if (!userId || !data?.token) return null;
    const expiresAt =
      data.expiresAt instanceof Date
        ? data.expiresAt.toISOString()
        : data.expiresAt;
    const row = {
      token: data.token,
      expiresAt,
      userId,
    };
    try {
      return await jsonDb.insertAwaited('refresh_tokens', row);
    } catch (err) {
      console.warn(
        '[auth] refresh_tokens unavailable — persisting via audit_log fallback:',
        err instanceof Error ? err.message : err,
      );
      const fallback = await jsonDb.insertAwaited('audit_log', {
        userId,
        action: 'AUTH_REFRESH_TOKEN',
        module: 'auth',
        details: data.token,
        metadata: { token: data.token, expiresAt, userId },
      });
      return {
        id: fallback.id,
        token: data.token,
        expiresAt,
        userId,
      };
    }
  }

  async findRefreshToken(tokenHash: string) {
    await jsonDb.refreshCollection('refresh_tokens');
    let stored = jsonDb.findOne('refresh_tokens', { token: tokenHash });

    if (!stored) {
      await jsonDb.refreshCollection('audit_log');
      const rows = jsonDb.findMany('audit_log', { action: 'AUTH_REFRESH_TOKEN' });
      const hit = rows.find((row: any) => {
        const metaToken = row?.metadata?.token ?? row?.details;
        return metaToken === tokenHash;
      });
      if (hit) {
        stored = {
          id: hit.id,
          token: tokenHash,
          userId: hit.userId ?? hit.metadata?.userId,
          expiresAt: hit.metadata?.expiresAt ?? hit.createdAt,
          _fallbackAuditId: hit.id,
        };
      }
    }

    if (!stored) return null;
    const user = await this.findById(stored.userId);
    if (!user) return null;
    return {
      ...stored,
      expiresAt: new Date(stored.expiresAt),
      user,
    };
  }

  async deleteRefreshToken(tokenHash: string) {
    try {
      await jsonDb.deleteAwaited('refresh_tokens', { token: tokenHash });
    } catch {
      /* table may not exist */
    }
    await jsonDb.refreshCollection('audit_log');
    const rows = jsonDb
      .findMany('audit_log', { action: 'AUTH_REFRESH_TOKEN' })
      .filter((row: any) => (row?.metadata?.token ?? row?.details) === tokenHash);
    for (const row of rows) {
      await jsonDb.deleteAwaited('audit_log', { id: row.id });
    }
  }

  async deleteUserRefreshTokens(userId: string) {
    try {
      await jsonDb.refreshCollection('refresh_tokens');
      const rows = jsonDb.findMany('refresh_tokens', { userId });
      for (const row of rows) {
        await jsonDb.deleteAwaited('refresh_tokens', { id: row.id });
      }
    } catch {
      /* table may not exist */
    }
    await jsonDb.refreshCollection('audit_log');
    const auditRows = jsonDb
      .findMany('audit_log', { action: 'AUTH_REFRESH_TOKEN' })
      .filter((row: any) => row.userId === userId || row?.metadata?.userId === userId);
    for (const row of auditRows) {
      await jsonDb.deleteAwaited('audit_log', { id: row.id });
    }
  }
}

export const authRepository = new AuthRepository();
