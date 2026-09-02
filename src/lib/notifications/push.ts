import { env } from "@/config/env";
import { WebPushChannel } from "@/lib/notifications/web-push";

/**
 * Browser / push delivery abstraction. Reminder + fan-out logic never imports a concrete
 * provider — it calls `getPushChannel().send(...)`. A real provider (Web Push, FCM, APNs …)
 * is a new file implementing `PushChannel` plus a branch in the factory below.
 */
export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushChannel {
  readonly name: string;
  readonly configured: boolean;
  send(subscription: unknown, message: PushMessage): Promise<void>;
}

/** No-op channel — records intent to the log until VAPID keys are configured. */
class NoopPushChannel implements PushChannel {
  readonly name = "noop";
  readonly configured = false;
  async send(_subscription: unknown, message: PushMessage): Promise<void> {
    console.info(`[push:noop] would send "${message.title}" — ${message.body}`);
  }
}

let cached: PushChannel | null = null;

export function getPushChannel(): PushChannel {
  if (cached) return cached;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cached = new WebPushChannel(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT);
  } else {
    cached = new NoopPushChannel();
  }
  return cached;
}

/** Whether real browser push is available on this deployment (VAPID configured). */
export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}
