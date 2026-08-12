/**
 * Safe Branch API smoke tests.
 * Creates/deletes ONLY disposable TEST-* records — never touches production seeds.
 *
 * Run: npx tsx scripts/smoke-branches.ts
 */
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { jsonDb } from '../src/config/json-db';
import { signAccessToken } from '../src/common/utils/jwt';
import { branchService } from '../src/modules/admin/branch/branch.service';
import {
  ConflictError,
  BadRequestError,
  NotFoundError,
  AppError,
} from '../src/common/errors/app-error';
import { createBranchBodySchema } from '../src/modules/admin/branch/branch.validator';

const MARKER = `TEST-BR-${Date.now()}`;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function expectError(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: any[]) => Error,
  label: string,
): Promise<AppError | Error> {
  try {
    await fn();
    throw new Error(`ASSERT: expected ${label} to throw ${ErrorClass.name}`);
  } catch (err) {
    assert(err instanceof ErrorClass, `${label} should be ${ErrorClass.name}, got ${err}`);
    return err as Error;
  }
}

async function http(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const server = app.listen(0);
  try {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function main() {
  await jsonDb.ready;
  await jsonDb.ensureCollection('branches');
  await jsonDb.ensureCollection('users');
  await jsonDb.ensureCollection('roles');

  const results: Record<string, string> = {};
  const createdIds: string[] = [];

  try {
    // —— Service: list ——
    const before = await branchService.list();
    assert(Array.isArray(before), 'list returns array');
    results.list = `PASS (${before.length} branches)`;

    // —— Service: create ——
    const created = await branchService.create({
      id: randomUUID(),
      name: `${MARKER} Ajmer`,
      branchCode: `${MARKER}-AJM`,
      city: 'Ajmer',
      state: 'Rajasthan',
      branchManager: 'Test Manager',
      mobile: '+91 90000 00001',
      status: 'active',
    });
    createdIds.push(created.id);
    assert(created.name === `${MARKER} Ajmer`, 'create name');
    assert(created.branchCode === `${MARKER}-AJM`, 'create code');
    assert(created.status === 'active', 'default/active status');
    results.create = 'PASS';

    // —— Service: get by id ——
    const one = await branchService.getById(created.id);
    assert(one.id === created.id, 'getById id');
    assert(one.city === 'Ajmer', 'getById city');
    results.getById = 'PASS';

    // —— Service: update (same name/code must succeed) ——
    const updated = await branchService.update(created.id, {
      name: `${MARKER} Ajmer`,
      branchCode: `${MARKER}-AJM`,
      city: 'Ajmer City',
      state: 'Rajasthan',
      branchManager: 'Test Manager 2',
      mobile: '+91 90000 00002',
      status: 'inactive',
    });
    assert(updated.city === 'Ajmer City', 'update city');
    assert(updated.status === 'inactive', 'update status');
    results.updateSelf = 'PASS';

    // —— Duplicate name (exact) ——
    const other = await branchService.create({
      name: `${MARKER} Other`,
      branchCode: `${MARKER}-OTH`,
      city: 'Jaipur',
      state: 'Rajasthan',
      branchManager: 'Other Mgr',
      mobile: '+91 90000 00003',
    });
    createdIds.push(other.id);
    await expectError(
      () =>
        branchService.create({
          name: `${MARKER} Ajmer`,
          branchCode: `${MARKER}-NEW`,
          city: 'X',
          state: 'Y',
          branchManager: 'Z',
          mobile: '1',
        }),
      ConflictError,
      'duplicate name',
    );
    results.dupName = 'PASS';

    // —— Duplicate code ——
    await expectError(
      () =>
        branchService.create({
          name: `${MARKER} Unique Name`,
          branchCode: `${MARKER}-AJM`,
          city: 'X',
          state: 'Y',
          branchManager: 'Z',
          mobile: '1',
        }),
      ConflictError,
      'duplicate code',
    );
    results.dupCode = 'PASS';

    // —— Case-insensitive name ——
    await expectError(
      () =>
        branchService.create({
          name: `${MARKER} ajmer`,
          branchCode: `${MARKER}-CI1`,
          city: 'X',
          state: 'Y',
          branchManager: 'Z',
          mobile: '1',
        }),
      ConflictError,
      'case-insensitive name',
    );
    results.dupNameCI = 'PASS';

    // —— Case-insensitive code ——
    await expectError(
      () =>
        branchService.create({
          name: `${MARKER} Unique CI`,
          branchCode: `${MARKER}-ajm`,
          city: 'X',
          state: 'Y',
          branchManager: 'Z',
          mobile: '1',
        }),
      ConflictError,
      'case-insensitive code',
    );
    results.dupCodeCI = 'PASS';

    // —— Missing required (zod) ——
    const missing = createBranchBodySchema.safeParse({
      name: '',
      branchCode: 'X',
      city: 'X',
      state: 'X',
      branchManager: 'X',
      mobile: 'X',
    });
    assert(!missing.success, 'empty name fails zod');
    results.missingRequired = 'PASS';

    // —— Invalid id ——
    await expectError(
      () => branchService.getById(randomUUID()),
      NotFoundError,
      'missing id',
    );
    await expectError(() => branchService.getById(''), BadRequestError, 'empty id');
    results.invalidId = 'PASS';

    // —— Delete unreferenced test branch ——
    const del = await branchService.delete(other.id);
    assert(del.deleted === true, 'delete flag');
    createdIds.splice(createdIds.indexOf(other.id), 1);
    await expectError(() => branchService.getById(other.id), NotFoundError, 'after delete');
    results.delete = 'PASS';

    // —— Delete protected when referenced by pincode ——
    const linked = await branchService.create({
      name: `${MARKER} Linked`,
      branchCode: `${MARKER}-LNK`,
      city: 'Kota',
      state: 'Rajasthan',
      branchManager: 'Link Mgr',
      mobile: '+91 90000 00004',
    });
    createdIds.push(linked.id);
    const pinId = randomUUID();
    jsonDb.insert('pincodes', {
      id: pinId,
      name: '999991',
      pincode: '999991',
      city: 'Kota',
      state: 'Rajasthan',
      branchName: linked.name,
      status: 'active',
    });
    await expectError(() => branchService.delete(linked.id), ConflictError, 'referenced delete');
    jsonDb.delete('pincodes', { id: pinId });
    await branchService.delete(linked.id);
    createdIds.splice(createdIds.indexOf(linked.id), 1);
    results.deleteProtected = 'PASS';

    // —— HTTP auth + RBAC ——
    const app = createApp();
    const prefix = '/api/v1';

    const unauth = await http(app, 'GET', `${prefix}/admin/branches`);
    assert(unauth.status === 401, `unauth expected 401 got ${unauth.status}`);
    results.auth = 'PASS';

    const admin =
      (jsonDb.findMany('users', {}) as any[]).find(
        (u) =>
          String(u.email ?? '') === 'admin@loanex.com' ||
          String(u.role ?? '') === 'admin' ||
          Boolean(u.role_id || u.roleId),
      ) ?? null;

    if (admin) {
      const token = signAccessToken({
        sub: admin.id,
        uuid: admin.id,
        email: admin.email ?? 'admin@loanex.com',
        mobile: admin.phone ?? '',
      });

      const listHttp = await http(app, 'GET', `${prefix}/admin/branches`, { token });
      assert(listHttp.status === 200, `list http ${listHttp.status}`);
      assert(listHttp.body?.success === true, 'list success');

      const createHttp = await http(app, 'POST', `${prefix}/admin/branches`, {
        token,
        body: {
          name: `${MARKER} Http`,
          branchCode: `${MARKER}-HTTP`,
          city: 'Udaipur',
          state: 'Rajasthan',
          branchManager: 'Http Mgr',
          mobile: '+91 90000 00005',
        },
      });
      assert(createHttp.status === 201, `create http ${createHttp.status} ${JSON.stringify(createHttp.body)}`);
      const httpId = createHttp.body?.data?.id as string;
      assert(Boolean(httpId), 'create returns id');
      createdIds.push(httpId);

      const getHttp = await http(app, 'GET', `${prefix}/admin/branches/${httpId}`, { token });
      assert(getHttp.status === 200, `get http ${getHttp.status}`);

      const putHttp = await http(app, 'PUT', `${prefix}/admin/branches/${httpId}`, {
        token,
        body: {
          name: `${MARKER} Http`,
          branchCode: `${MARKER}-HTTP`,
          city: 'Udaipur',
          state: 'Rajasthan',
          branchManager: 'Http Mgr Updated',
          mobile: '+91 90000 00005',
          status: 'active',
        },
      });
      assert(putHttp.status === 200, `put http ${putHttp.status}`);

      const delHttp = await http(app, 'DELETE', `${prefix}/admin/branches/${httpId}`, { token });
      assert(delHttp.status === 200, `delete http ${delHttp.status}`);
      createdIds.splice(createdIds.indexOf(httpId), 1);

      const forbidToken = signAccessToken({
        sub: randomUUID(),
        uuid: randomUUID(),
        email: 'nobody@example.com',
        mobile: '',
      });
      const forbid = await http(app, 'GET', `${prefix}/admin/branches`, { token: forbidToken });
      assert(forbid.status === 403 || forbid.status === 401, `rbac deny got ${forbid.status}`);
      results.rbac = 'PASS';
      results.http = 'PASS';
    } else {
      results.http = 'SKIP (no admin user in jsonDb)';
      results.rbac = 'SKIP';
    }

    console.log(JSON.stringify({ ok: true, marker: MARKER, results }, null, 2));
  } finally {
    for (const id of createdIds) {
      try {
        await branchService.delete(id);
      } catch {
        // ignore — may already be gone or protected
        try {
          jsonDb.delete('branches', { id });
        } catch {
          /* ignore */
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.stack || err) }, null, 2));
  process.exit(1);
});
