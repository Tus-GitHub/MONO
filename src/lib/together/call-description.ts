/** Trickle ICE enriches an SDP in place; it does not make it a new negotiation. */
export function sameCallDescription(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const negotiation = (sdp: string) => sdp.split(/\r?\n/)
    .filter(line => line && !line.startsWith("a=candidate:") && line !== "a=end-of-candidates")
    .join("\n");
  // Keep session version, ICE credentials, media and fingerprints significant.
  return negotiation(left) === negotiation(right);
}
