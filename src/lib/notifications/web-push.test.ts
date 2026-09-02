import {
  createDecipheriv,
  createECDH,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { importJWK, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { encryptWebPushPayload, PushSubscriptionGoneError, WebPushChannel } from "./web-push";

/** A spec-compliant client-side decrypt of an `aes128gcm` Web Push body (RFC 8188 + 8291). */
function decryptAsClient(
  body: Buffer,
  clientEcdh: ReturnType<typeof createECDH>,
  authSecret: Buffer,
): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const serverPub = body.subarray(21, 21 + idlen);
  const encrypted = body.subarray(21 + idlen);

  const shared = clientEcdh.computeSecret(serverPub);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "ascii"),
    clientEcdh.getPublicKey(),
    serverPub,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0", "ascii"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0", "ascii"), 12),
  );

  const tag = encrypted.subarray(encrypted.length - 16);
  const ct = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const record = Buffer.concat([decipher.update(ct), decipher.final()]);

  let end = record.length - 1;
  while (end >= 0 && record[end] === 0) end -= 1; // trailing zero padding
  expect(record[end]).toBe(0x02); // last-record delimiter
  return record.subarray(0, end);
}

function makeClientSubscription() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh,
    auth,
    sub: {
      endpoint: "https://fcm.googleapis.com/fcm/send/dEaDbEeF",
      keys: {
        p256dh: ecdh.getPublicKey().toString("base64url"),
        auth: auth.toString("base64url"),
      },
    },
  };
}

function makeVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = publicKey.export({ type: "spki", format: "der" });
  const point = spki.subarray(spki.length - 65);
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const marker = pkcs8.indexOf(Buffer.from([0x04, 0x20]));
  return {
    pub: point.toString("base64url"),
    priv: pkcs8.subarray(marker + 2, marker + 2 + 32).toString("base64url"),
    point,
  };
}

describe("Web Push payload encryption", () => {
  it("round-trips — a compliant client decrypts exactly what the channel encrypts", () => {
    const { ecdh, auth, sub } = makeClientSubscription();
    const plaintext = Buffer.from(
      JSON.stringify({ title: "Your date is tomorrow", body: "Fri · 7:00 PM", url: "/dates/x" }),
      "utf8",
    );
    const body = encryptWebPushPayload(sub, plaintext);

    // header shape: salt(16) rs(4) idlen(1)=65 serverPub(65) then ciphertext+tag
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body.readUInt8(20)).toBe(65);
    expect(body[21]).toBe(0x04); // uncompressed EC point marker

    expect(decryptAsClient(body, ecdh, auth).equals(plaintext)).toBe(true);
  });

  it("produces a different salt / ciphertext every call", () => {
    const { sub } = makeClientSubscription();
    const p = Buffer.from("same", "utf8");
    const a = encryptWebPushPayload(sub, p);
    const b = encryptWebPushPayload(sub, p);
    expect(a.subarray(0, 16).equals(b.subarray(0, 16))).toBe(false); // salt
    expect(a.equals(b)).toBe(false);
  });
});

describe("WebPushChannel", () => {
  it("sends a valid VAPID Authorization header, aes128gcm body, and TTL", async () => {
    const { pub, priv, point } = makeVapidKeys();
    const { sub } = makeClientSubscription();
    const channel = new WebPushChannel(pub, priv, "mailto:ops@example.com");

    let captured: { url: string; init: RequestInit } | null = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(null, { status: 201 });
    }) as typeof fetch;

    try {
      await channel.send(sub, { title: "Hi", body: "there", url: "/notifications" });
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(captured).not.toBeNull();
    const { url, init } = captured!;
    expect(url).toBe(sub.endpoint);
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers["TTL"]).toBe("86400");

    const auth = headers["Authorization"];
    expect(auth.startsWith("vapid t=")).toBe(true);
    const [, jwt] = /vapid t=([^,]+), k=(.+)/.exec(auth)!;
    expect(auth.endsWith(`k=${pub}`)).toBe(true);

    const vapidKey = await importJWK(
      {
        kty: "EC",
        crv: "P-256",
        x: point.subarray(1, 33).toString("base64url"),
        y: point.subarray(33, 65).toString("base64url"),
      },
      "ES256",
    );
    const { payload } = await jwtVerify(jwt, vapidKey);
    expect(payload.aud).toBe("https://fcm.googleapis.com");
    expect(payload.sub).toBe("mailto:ops@example.com");
    expect(typeof payload.exp).toBe("number");
  });

  it("maps a 410 from the push service to PushSubscriptionGoneError", async () => {
    const { pub, priv } = makeVapidKeys();
    const { sub } = makeClientSubscription();
    const channel = new WebPushChannel(pub, priv, "mailto:ops@example.com");

    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 410 })) as typeof fetch;
    try {
      await expect(channel.send(sub, { title: "x", body: "y" })).rejects.toBeInstanceOf(
        PushSubscriptionGoneError,
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("rejects a malformed subscription as gone", async () => {
    const { pub, priv } = makeVapidKeys();
    const channel = new WebPushChannel(pub, priv, "mailto:ops@example.com");
    await expect(channel.send({ nope: true }, { title: "x", body: "y" })).rejects.toBeInstanceOf(
      PushSubscriptionGoneError,
    );
  });
});
