import { Hono } from 'hono';
import postgres from 'postgres';
import { eq, desc } from 'drizzle-orm';
import { db } from '../shared/db';
import { accessRequests, accessAllowlist } from '@kortix/db';
import { areSignupsEnabled, canSignUp, refreshAccessControlCache } from '../shared/access-control-cache';
import { config } from '../config';
import { supabaseAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/require-admin';

export const accessControlApp = new Hono();

async function userExistsInAuth(email: string): Promise<boolean> {
  if (!config.DATABASE_URL) return false;
  const sql = postgres(config.DATABASE_URL, { max: 1 });
  try {
    const [row] = await sql`
      SELECT 1 FROM auth.users WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `;
    return !!row;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

accessControlApp.get('/signup-status', (c) => {
  return c.json({ signupsEnabled: areSignupsEnabled() });
});

accessControlApp.post('/check-email', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email) return c.json({ error: 'email required' }, 400);

  if (canSignUp(email)) {
    return c.json({ allowed: true });
  }

  if (await userExistsInAuth(email)) {
    return c.json({ allowed: true });
  }

  return c.json({ allowed: false });
});

accessControlApp.post('/request-access', async (c) => {
  const body = await c.req.json<{ email: string; company?: string; useCase?: string }>();
  if (!body.email || !body.email.includes('@')) {
    return c.json({ error: 'valid email required' }, 400);
  }

  const normalizedEmail = body.email.trim().toLowerCase();

  await db.insert(accessRequests).values({
    email: normalizedEmail,
    company: body.company || null,
    useCase: body.useCase || null,
  });

  return c.json({ success: true, message: 'Access request submitted' });
});

// ─── Admin endpoints (auth + platform admin) ───────────────────────────────
// Used by the admin "Acesso" panel to grant/revoke access by email.

accessControlApp.use('/admin/*', supabaseAuth, requireAdmin);

// Current invite-only status + counts
accessControlApp.get('/admin/status', async (c) => {
  const list = await db.select().from(accessAllowlist);
  return c.json({ signupsEnabled: areSignupsEnabled(), allowlistCount: list.length });
});

// List allowlist entries (emails + domains)
accessControlApp.get('/admin/allowlist', async (c) => {
  const list = await db.select().from(accessAllowlist).orderBy(desc(accessAllowlist.createdAt));
  return c.json({ entries: list });
});

// Grant access: add an email (or domain) to the allowlist
accessControlApp.post('/admin/allowlist', async (c) => {
  const body = await c.req.json<{ value: string; entryType?: 'email' | 'domain'; note?: string }>();
  const value = (body.value || '').trim().toLowerCase();
  const entryType = body.entryType === 'domain' ? 'domain' : 'email';
  if (!value || (entryType === 'email' && !value.includes('@'))) {
    return c.json({ error: 'valid email required' }, 400);
  }
  const [entry] = await db
    .insert(accessAllowlist)
    .values({ entryType, value, note: body.note || null })
    .onConflictDoNothing()
    .returning();
  await refreshAccessControlCache();
  return c.json({ success: true, entry: entry ?? { entryType, value } });
});

// Revoke access: remove an allowlist entry
accessControlApp.delete('/admin/allowlist/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(accessAllowlist).where(eq(accessAllowlist.id, id));
  await refreshAccessControlCache();
  return c.json({ success: true });
});

// List access requests (optionally filter by status)
accessControlApp.get('/admin/requests', async (c) => {
  const status = c.req.query('status');
  const rows = status
    ? await db.select().from(accessRequests).where(eq(accessRequests.status, status as any)).orderBy(desc(accessRequests.createdAt))
    : await db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt));
  return c.json({ requests: rows });
});

// Approve a request → mark approved + add its email to the allowlist
accessControlApp.post('/admin/requests/:id/approve', async (c) => {
  const id = c.req.param('id');
  const [req] = await db.update(accessRequests).set({ status: 'approved', updatedAt: new Date() }).where(eq(accessRequests.id, id)).returning();
  if (req?.email) {
    await db.insert(accessAllowlist).values({ entryType: 'email', value: req.email.toLowerCase(), note: 'approved request' }).onConflictDoNothing();
    await refreshAccessControlCache();
  }
  return c.json({ success: true });
});

// Reject a request
accessControlApp.post('/admin/requests/:id/reject', async (c) => {
  const id = c.req.param('id');
  await db.update(accessRequests).set({ status: 'rejected', updatedAt: new Date() }).where(eq(accessRequests.id, id));
  return c.json({ success: true });
});
