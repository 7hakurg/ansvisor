#!/usr/bin/env node
/**
 * Writes the Supabase Auth e-mail templates (auth-email-templates.js) to
 * web/public/email/auth, where the web app serves them to Supabase Auth.
 * Run after changing a template or the e-mail layout: `npm run email:auth`.
 * With --env <web origin>, also prints the auth service's settings for them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_EMAILS,
  AUTH_EMAIL_DIR,
  authEmailEnv,
  renderAuthEmail,
} from '../src/lib/auth-email-templates.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'web', 'public', AUTH_EMAIL_DIR);

mkdirSync(outDir, { recursive: true });
for (const email of AUTH_EMAILS) {
  writeFileSync(join(outDir, `${email.key}.html`), renderAuthEmail(email));
}
console.error(`wrote ${AUTH_EMAILS.length} templates to ${outDir}`);

const envAt = process.argv.indexOf('--env');
if (envAt !== -1) {
  const origin = process.argv[envAt + 1];
  if (!origin || !/^https?:\/\//.test(origin)) {
    console.error('usage: build-auth-email-templates.js [--env https://app.example.com]');
    process.exit(1);
  }
  for (const [key, value] of Object.entries(authEmailEnv(origin))) {
    console.log(`${key}=${value}`);
  }
}
