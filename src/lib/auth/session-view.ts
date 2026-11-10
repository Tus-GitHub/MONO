/** Public session metadata only; credentials and raw user agents never reach the settings UI. */
export interface AuthSessionView {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}
