import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../../config/env';
import type { MailMessage, MailProvider } from '../types';

/** The default provider. SMTP via nodemailer, exactly as before this module existed. */
export class NodemailerProvider implements MailProvider {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      // 465 is implicit TLS; anything else negotiates with STARTTLS.
      secure: env.email.port === 465,
      auth: { user: env.email.user!, pass: env.email.password! },
    });
    return this.transporter;
  }

  async send({ to, subject, html, text, attachments }: MailMessage): Promise<void> {
    await this.getTransporter().sendMail({
      from: `"${env.email.fromName}" <${env.email.user}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
  }
}
