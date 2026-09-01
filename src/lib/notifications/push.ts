import { env } from "@/config/env";

/**
 * Browser / push delivery abstraction. Reminder logic never imports a concrete provider —
 * it calls `getPushChannel().send(...)`. Wire a real channel (web-push + VAPID, FCM, APNs …)
 * by implementing `PushChannel` and returning it from the factory.
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

/** No-op channel — records intent to the log until a provider is configured. */
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
  // Example wiring point:
  //   if (env.PUSH_PROVIDER === "web-push" && env.VAPID_PRIVATE_KEY) {
  //     cached = new WebPushChannel(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  //     return cached;
  //   }
  void env;
  cached = new NoopPushChannel();
  return cached;
}
