// Browser-only key operations. The recovery secret and CryptoKey never go to the API.
export interface ChatKey { id: string; key: CryptoKey }
const encoder = new TextEncoder();
export function base64(bytes: Uint8Array): string {
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) value += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(value);
}
export const unbase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export function newRecoveryCode() {
  return `MONO1-${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("").match(/.{8}/g)!.join("-")}`;
}
export async function recoverChatKey(code: string, coupleId: string): Promise<ChatKey> {
  const hex = code.trim().toUpperCase().replace(/^MONO1-/, "").replace(/[-\s]/g, "");
  if (!/^[0-9A-F]{64}$/.test(hex)) throw new Error("Enter the complete MONO recovery code.");
  const secret = Uint8Array.from(hex.match(/../g)!, (v) => parseInt(v, 16));
  try {
    const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey", "deriveBits"]);
    const salt = encoder.encode(`mono:chat:v1:${coupleId}`);
    const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("content") }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const fingerprint = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("fingerprint") }, material, 256);
    return { key, id: Array.from(new Uint8Array(fingerprint), (b) => b.toString(16).padStart(2, "0")).join("") };
  } finally { secret.fill(0); }
}
export const chatAAD = (coupleId: string, senderId: string, nonce: string, kind: string) => JSON.stringify(["mono-chat-v1", coupleId, senderId, nonce, kind]);
export async function encryptBytes(key: ChatKey, bytes: Uint8Array, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(aad) }, key.key, new Uint8Array(bytes));
  return { iv: base64(iv), data: base64(new Uint8Array(ciphertext)) };
}
export async function decryptBytes(key: ChatKey, envelope: { iv: string; data: string }, aad: string) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(envelope.iv), additionalData: encoder.encode(aad) }, key.key, unbase64(envelope.data)));
}
export async function encryptText(key: ChatKey, text: string, aad: string) {
  return JSON.stringify({ v: 1, keyId: key.id, ...await encryptBytes(key, encoder.encode(text), aad) });
}
export async function decryptText(key: ChatKey, text: string, aad: string) {
  const value = JSON.parse(text);
  if (value.v !== 1 || value.keyId !== key.id) throw new Error("This message needs the matching recovery code.");
  return new TextDecoder("utf-8", { fatal: true }).decode(await decryptBytes(key, value, aad));
}
function openKeys(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mono-chat-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("This browser cannot save your chat key. Allow site storage and try again."));
  });
}
// Scope by both account and space so signing into another account cannot select this key.
export async function storedChatKey(scope: string, value?: ChatKey): Promise<ChatKey | undefined> {
  const db = await openKeys();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", value ? "readwrite" : "readonly");
    const request = value ? tx.objectStore("keys").put(value, scope) : tx.objectStore("keys").get(scope);
    tx.oncomplete = () => { db.close(); resolve(value ?? request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error("Could not save or read the chat key on this device.")); };
  });
}
