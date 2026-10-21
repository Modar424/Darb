import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/configuration';

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail abstraction. Phase 1 ships no SMTP integration (documented gap).
 * - `console` (development only): prints the message, INCLUDING the reset link, so the flow can be exercised locally.
 *   This is the single deliberate exception to "never log reset tokens"; production config rejects it.
 * - `none`: discards the message.
 * In NODE_ENV=test the messages are captured in memory for assertions and never printed.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  readonly outbox: OutboundMail[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async send(mail: OutboundMail): Promise<void> {
    if (this.config.env === 'test') {
      this.outbox.push(mail);
      return;
    }
    if (this.config.mailTransport === 'console') {
      this.logger.warn(`[DEV MAIL] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    }
  }
}
