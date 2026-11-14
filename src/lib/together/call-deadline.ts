import type { CallDTO } from "./types";

/** Ringing and transport negotiation have separate budgets. Polls never extend either. */
export function callDeadline(expire: (reason: "unanswered" | "connection") => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stage: "ringing" | "connecting" | "connected" | "disconnected" | "stopped" | undefined;
  const arm = (next: typeof stage, delay: number, reason: "unanswered" | "connection") => {
    if (stage === next || stage === "stopped") return;
    clearTimeout(timer); stage = next;
    timer = setTimeout(() => { stage = "stopped"; expire(reason); }, delay);
  };
  return {
    observe(call: Pick<CallDTO, "status" | "createdAt">) {
      if (call.status === "RINGING") arm("ringing", Math.max(0, Date.parse(call.createdAt) + 61_000 - Date.now()), "unanswered");
      else if (call.status === "ACCEPTED" && stage !== "connected" && stage !== "disconnected") arm("connecting", 40_000, "connection");
    },
    connection(state: RTCPeerConnectionState) {
      if (stage === "stopped") return;
      if (state === "connected") { clearTimeout(timer); stage = "connected"; }
      else if (state === "disconnected") arm("disconnected", 15_000, "connection");
      else if (state === "failed" && stage !== "ringing") { clearTimeout(timer); stage = "stopped"; expire("connection"); }
    },
    stop() { clearTimeout(timer); stage = "stopped"; },
  };
}
