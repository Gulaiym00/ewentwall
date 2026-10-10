import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

/**
 * Outgoing email over SMTP (Gmail by default: SMTP_USER + an app password in SMTP_PASS).
 * Without those variables email is off and `enabled` is false; the admin UI says how to turn it on.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly transport?: Transporter;
  private readonly from?: string;

  constructor(config: ConfigService<Env, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    if (!user || !pass) return;
    const port = config.get('SMTP_PORT', { infer: true });
    this.transport = createTransport({ host: config.get('SMTP_HOST', { infer: true }), port, secure: port === 465, auth: { user, pass } });
    this.from = config.get('MAIL_FROM', { infer: true }) ?? `EventWall <${user}>`;
  }

  get enabled() {
    return !!this.transport;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transport) throw new ServiceUnavailableException('Email is not set up on the server (SMTP_USER / SMTP_PASS)');
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      this.log.error(`Sending to ${to} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('The email could not be sent. Check SMTP_USER / SMTP_PASS on the server.');
    }
  }
}
