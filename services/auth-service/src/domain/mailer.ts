import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Astrazione per l'invio email, iniettabile per rendere i test indipendenti
 * da un vero server SMTP (vedi `fakeMailer` in test/helpers.ts).
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface MailerConfig {
  host: string;
  port: number;
  from: string;
}

/**
 * Implementazione reale via SMTP (Mailpit in locale, un vero relay SMTP in
 * produzione). Mailpit non richiede autenticazione ne' TLS.
 */
export function createNodemailerMailer(config: MailerConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async send(message: MailMessage): Promise<void> {
      await transport.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
