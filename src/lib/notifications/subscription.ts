import { z } from "zod";

/** Browser push endpoints are capabilities; accept only supported provider HTTPS origins. */
export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")
      && (url.hostname === "fcm.googleapis.com" || url.hostname === "web.push.apple.com"
        || url.hostname === "updates.push.services.mozilla.com"
        || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}

export const pushEndpointSchema = z.string().max(2048).refine(isPushEndpoint, "Unsupported push endpoint.");
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
  }),
});
