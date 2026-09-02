/**
 * Generate a VAPID (P-256) key pair for Web Push and print the three env lines.
 *
 *   node scripts/generate-vapid.mjs        (or: npm run vapid)
 *
 * VAPID keys identify this server to the push services; they don't need rotating and are not
 * a secret in the way a session key is (the public half is handed to every browser). Paste
 * the output into `.env` locally and into the Vercel env for production.
 */
import { generateKeyPairSync, createPublicKey } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

// Public key → uncompressed EC point (65 bytes: 0x04 ‖ X ‖ Y), base64url.
const spki = publicKey.export({ type: "spki", format: "der" });
const point = spki.subarray(spki.length - 65); // trailing raw point in the SPKI DER
const pub = point.toString("base64url");

// Private key → raw 32-byte scalar, base64url.
const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
// The 32-byte private scalar sits right after the 0x04 0x20 marker inside the PKCS#8 OCTET STRING.
const marker = pkcs8.indexOf(Buffer.from([0x04, 0x20]));
const priv = pkcs8.subarray(marker + 2, marker + 2 + 32).toString("base64url");

// Sanity: re-derive the public point from the private key and compare.
const rederived = createPublicKey(privateKey).export({ type: "spki", format: "der" });
if (!rederived.subarray(rederived.length - 65).equals(point)) {
  console.error("key derivation mismatch — regenerate");
  process.exit(1);
}

console.log("# --- Web Push (VAPID) ---");
console.log(`VAPID_PUBLIC_KEY="${pub}"`);
console.log(`VAPID_PRIVATE_KEY="${priv}"`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${pub}"`);
console.log(`VAPID_SUBJECT="mailto:you@example.com"   # your contact address`);
