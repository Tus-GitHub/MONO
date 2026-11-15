import "server-only";
import { env } from "@/config/env";
import { createPrivateCrypto, type PrivateCrypto } from "./crypto";

let crypto: PrivateCrypto | undefined;
export function privateCrypto(): PrivateCrypto {
  if (!crypto) crypto = createPrivateCrypto(env.DATA_ENCRYPTION_KEY);
  return crypto;
}
