/**
 * Email abstraction. Password recovery (and later, notifications) send through a driver,
 * never a hard-coded provider. Development uses the console driver.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDriver {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
