import "server-only";

import { createCipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";

import { importJWK, SignJWT } from "jose";

import type { PushChannel, PushMessage } from "@/lib/notifications/push";

/**
 * Web Push over VAPID, hand-rolled on Node crypto + `jose` (already a dependency) — no
 * `web-push` package.
 *
 *   - Payload encryption: RFC 8291 (key derivation) + RFC 8188 `aes128gcm` content encoding.
 *   - Server identification: RFC 8292 (VAPID) — an ES256 JWT in the `Authorization` header.
 *
 * The one concrete provider. Reminder / fan-out code only ever sees the `PushChannel`
 * interface, so swapping in FCM/APNs later is a new file, not a rewrite.
 */

/** Thrown when the push service says the subscription is gone (404/410) — caller should clear it. */
export class PushSubscriptionGoneError extends Error {
  constructor() {
    super("push subscription no longer valid");
    this.name = "PushSubscriptionGoneError";
  }
}

interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isSubscription(v: unknown): v is BrowserSubscription {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const keys = s.keys as Record<string, unknown> | undefined;
  return (
    typeof s.endpoint === "string" &&
    !!keys &&
    typeof keys.p256dh === "string" &&
    typeof keys.auth === "string"
  );
}

const RECORD_SIZE = 4096;
const CE_INFO = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
const NONCE_INFO = Buffer.from("Content-Encoding: nonce\0", "ascii");

/**
 * RFC 8291 + RFC 8188 → the encrypted `aes128gcm` request body. Exported for the round-trip
 * test; the class uses it internally.
 */
export function encryptWebPushPayload(
  sub: { keys: { p256dh: string; auth: string } },
  plaintext: Buffer,
): Buffer {
  const clientPub = Buffer.from(sub.keys.p256dh, "base64url"); // 65 bytes (uncompressed point)
  const authSecret = Buffer.from(sub.keys.auth, "base64url"); // 16 bytes

  const server = createECDH("prime256v1");
  server.generateKeys();
  const serverPub = server.getPublicKey(); // 65 bytes
  const sharedSecret = server.computeSecret(clientPub); // 32 bytes

  // RFC 8291 §3.4: PRK/IKM = HKDF(salt = auth_secret, ikm = ecdh, info = "WebPush: info"‖0‖ua‖as)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "ascii"), clientPub, serverPub]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));

  // RFC 8188 aes128gcm
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, CE_INFO, 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, NONCE_INFO, 12));

  // One record: plaintext ‖ 0x02 (last-record delimiter). No extra zero padding needed.
  const record = Buffer.concat([plaintext, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  // Header block: salt(16) ‖ rs(4, BE) ‖ idlen(1) ‖ keyid(=server public key, 65)
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPub.length, 20);

  return Buffer.concat([header, serverPub, ciphertext]);
}

export class WebPushChannel implements PushChannel {
  readonly name = "web-push";
  readonly configured = true;

  constructor(
    private readonly vapidPublicKey: string,
    private readonly vapidPrivateKey: string,
    private readonly subject: string,
  ) {}

  /** Build the `Authorization: vapid …` header for one push endpoint's origin. */
  private async vapidHeader(endpointOrigin: string): Promise<string> {
    const pub = Buffer.from(this.vapidPublicKey, "base64url"); // 0x04 ‖ X(32) ‖ Y(32)
    const key = await importJWK(
      {
        kty: "EC",
        crv: "P-256",
        d: this.vapidPrivateKey,
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33, 65).toString("base64url"),
      },
      "ES256",
    );
    const jwt = await new SignJWT({})
      .setProtectedHeader({ typ: "JWT", alg: "ES256" })
      .setAudience(endpointOrigin)
      .setSubject(this.subject)
      .setExpirationTime("12h")
      .sign(key);
    return `vapid t=${jwt}, k=${this.vapidPublicKey}`;
  }

  async send(subscription: unknown, message: PushMessage): Promise<void> {
    if (!isSubscription(subscription)) throw new PushSubscriptionGoneError();

    const origin = new URL(subscription.endpoint).origin;
    const payload = Buffer.from(
      JSON.stringify({
        title: message.title,
        body: message.body,
        url: message.url ?? "/notifications",
        tag: message.tag,
      }),
      "utf8",
    );
    const body = encryptWebPushPayload(subscription, payload);

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: await this.vapidHeader(origin),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "normal",
        ...(message.tag ? { Topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
      },
      body: new Uint8Array(body),
    });

    if (res.status === 404 || res.status === 410) throw new PushSubscriptionGoneError();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`push endpoint ${res.status}: ${detail.slice(0, 200)}`);
    }
  }
}
