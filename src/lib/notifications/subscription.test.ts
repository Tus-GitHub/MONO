import { expect, it } from "vitest";
import { createECDH, randomBytes } from "node:crypto";
import { isPushEndpoint, pushSubscriptionSchema } from "./subscription";

it.each([
  "http://fcm.googleapis.com/push", "https://127.0.0.1/push", "https://localhost/push",
  "https://fcm.googleapis.com.attacker.invalid/push", "https://user:pass@fcm.googleapis.com/push",
  "https://fcm.googleapis.com:8443/push", "https://attacker.invalid/push",
])("rejects an untrusted push target: %s", (endpoint) => expect(isPushEndpoint(endpoint)).toBe(false));

it.each([
  "https://fcm.googleapis.com/fcm/send/token", "https://updates.push.services.mozilla.com/wpush/v2/token",
  "https://web.push.apple.com/token", "https://wns2.notify.windows.com/token",
])("accepts a supported browser service: %s", (endpoint) => expect(isPushEndpoint(endpoint)).toBe(true));

it("validates and retains the browser encryption keys", () => {
  const key = createECDH("prime256v1"); key.generateKeys();
  const data = { endpoint: "https://fcm.googleapis.com/push", keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
  expect(pushSubscriptionSchema.parse(data)).toEqual(data);
  expect(pushSubscriptionSchema.safeParse({ ...data, keys: { p256dh: "bad", auth: "bad" } }).success).toBe(false);
});
