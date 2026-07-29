import { createRequire } from 'module';
const require    = createRequire(import.meta.url);
const nodemailer = require('nodemailer');

import { logger } from '../../utils/logger.js';

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const emailService = {
  async sendPasswordReset({ to, name, token }) {
    const base    = process.env.BASE_URL || 'http://localhost:4300';
    // const link    = `${base}/finanaly/auth/reset-password?token=${token}`;
    const link    = `${base}/aisworg/auth/reset-password?token=${token}`;
    const from    = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@finanaly.app';
    const subject = 'Reset your CapWise password';
    const html    = `
      <p>Hi ${name || 'there'},</p>
      <p>Click the link below to reset your CapWise password (valid 1 hour):</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request a password reset, ignore this email.</p>
    `;

    const transport = buildTransport();
    if (!transport) {
      logger.warn(`[emailService] SMTP not configured. Password reset link for ${to}: ${link}`);
      return { success: true, link };
    }

    try {
      await transport.sendMail({ from, to, subject, html });
      logger.info(`[emailService] Password reset email sent to ${to}`);
      return { success: true };
    } catch (err) {
      logger.error(`[emailService] Failed to send reset email to ${to}:`, err);
      throw err;
    }
  },

  async sendVerification({ to, name, token }) {
    const base     = process.env.BASE_URL || 'http://localhost:4300';
    // const link     = `${base}/finanaly/auth/verify?token=${token}`;
    const link     = `${base}/aisworg/auth/verify?token=${token}`;
    const from     = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@finanaly.app';
    const subject  = 'Set your CapWise password';
    const html     = `
      <p>Hi ${name || 'there'},</p>
      <p>A CapWise account has been created for you. Click the link below to set your password (valid 48 hours):</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not expect this, ignore this email.</p>
    `;

    const transport = buildTransport();
    if (!transport) {
      // SMTP not configured yet — log the link so dev can test manually.
      logger.warn(`[emailService] SMTP not configured. Verification link for ${to}: ${link}`);
      return { success: true, link };
    }

    try {
      await transport.sendMail({ from, to, subject, html });
      logger.info(`[emailService] Verification email sent to ${to}`);
      return { success: true };
    } catch (err) {
      logger.error(`[emailService] Failed to send to ${to}:`, err);
      throw err;
    }
  },
};
