'use strict';
const path = require('node:path');
const { db } = require('./src/db');
const { seedIfEmpty } = require('./src/seed');
const { createApp } = require('./src/http');
const { registerApi, expireStale } = require('./src/api');
const auth = require('./src/auth');
const { normalizePhone } = require('./src/util');

async function ensureAdmin() {
  const phone = normalizePhone(process.env.ADMIN_PHONE || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!process.env.ADMIN_PHONE && !password) return;
  if (!phone || password.length < 8) {
    console.warn('[admin] ADMIN_PHONE must be a valid BD mobile number and ADMIN_PASSWORD at least 8 characters - admin not created');
    return;
  }
  const hash = await auth.hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hash, existing.id);
  } else {
    db.prepare("INSERT INTO users (name, phone, password_hash, role) VALUES ('Administrator', ?, ?, 'admin')").run(phone, hash);
  }
  console.log('[admin] admin account ready for', phone);
}

async function main() {
  if (seedIfEmpty()) console.log('[db] seeded a fresh database');
  await ensureAdmin();

  const app = createApp({
    publicDir: path.join(__dirname, 'public'),
    trustProxy: process.env.TRUST_PROXY === '1',
  });
  registerApi(app);

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  app.server.listen(port, host, () => console.log(`[server] Go Trip BD listening on http://${host}:${port}`));

  const sweeper = setInterval(() => {
    try {
      expireStale();
    } catch (err) {
      console.error('[sweeper]', err);
    }
  }, 60_000);
  sweeper.unref();

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    app.server.close(() => {
      try {
        db.close();
      } catch {
        /* already closed */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
