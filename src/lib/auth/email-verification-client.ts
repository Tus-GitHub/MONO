import { errorState, type ActionState } from "@/lib/utils/result";

type VerificationRequest = { action: "confirm" | "remember"; token: string } | { action: "check" };

/** A dropped connection must release the form; never put mailbox tokens in URLs or logs. */
export async function postEmailVerification(input: VerificationRequest): Promise<ActionState> {
  try {
    const response = await fetch("/api/auth/email-verification", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (result.status === "success" && response.ok) return { status: "success", message: result.message };
    if (result.status === "error" && typeof result.message === "string") return errorState(result.message);
  } catch { /* A retry may report an already-consumed link; the signed-in status check is authoritative. */ }
  return errorState("The connection took too long. Check your connection and try again. If you already confirmed, continue to MONO to check your status.");
}
