/** Recover ICE on the existing peer; never stop media or create a second call. */
export function callRecovery(options: {
  eligible: () => boolean; online: () => boolean; stable: () => boolean;
  recover: () => Promise<void>; onError: (error: unknown) => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined, stopped = false, busy = false, lastAttempt = -Infinity;
  const schedule = (delay: number) => { if (stopped || timer) return; timer = setTimeout(() => { timer = undefined; void run(); }, delay); };
  const run = async () => {
    if (stopped || busy || !options.eligible()) return;
    if (!options.online()) { schedule(1000); return; }
    if (Date.now() - lastAttempt < 10_000) { schedule(10_000 - (Date.now() - lastAttempt)); return; }
    busy = true; lastAttempt = Date.now();
    let failed = false;
    try { await options.recover(); }
    catch (error) { failed = true; if (!stopped) options.onError(error); }
    finally { busy = false; if (!stopped && (failed || !options.stable())) schedule(10_000); }
  };
  return {
    request: () => schedule(300),
    observe: (state: RTCPeerConnectionState) => {
      if (state === "connected" && options.stable()) { clearTimeout(timer); timer = undefined; }
      else if (state === "disconnected" || state === "failed") schedule(state === "failed" ? 0 : 2500);
    },
    stop: () => { stopped = true; clearTimeout(timer); timer = undefined; },
  };
}

/** New-network candidates may arrive before their restart offer; retain them until it is applied. */
export function canApplyCallIce(candidate: RTCIceCandidateInit, remoteSdp?: string) {
  if (!remoteSdp) return false;
  const ufrag = candidate.usernameFragment ?? candidate.candidate?.match(/(?:^| )ufrag ([^ ]+)/)?.[1];
  return !ufrag || remoteSdp.split(/\r?\n/).includes(`a=ice-ufrag:${ufrag}`);
}
