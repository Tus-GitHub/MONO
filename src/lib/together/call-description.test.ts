import { expect, it } from "vitest";
import { sameCallDescription } from "./call-description";

const offer = "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=ice-ufrag:network1\r\na=ice-pwd:secret1\r\na=fingerprint:sha-256 AA:BB\r\na=sendrecv\r\n";
it("recognizes a retried offer or answer after candidates enrich its browser description", () => {
  const gathered = offer + "a=candidate:1 1 udp 123 192.0.2.1 5678 typ host\r\na=end-of-candidates\r\n";
  expect(sameCallDescription(offer, gathered)).toBe(true);
  expect(sameCallDescription(gathered, offer.replaceAll("\r\n", "\n"))).toBe(true);
});
it.each([
  ["123 2", "123 3"], ["network1", "network2"], ["secret1", "secret2"],
  ["AA:BB", "CC:DD"], ["sendrecv", "recvonly"], ["SAVPF 111", "SAVPF 0"],
])("preserves negotiation changes to %s", (before, after) => {
  expect(sameCallDescription(offer, offer.replace(before, after))).toBe(false);
});
it("does not match missing descriptions", () => {
  expect(sameCallDescription(undefined, offer)).toBe(false);
  expect(sameCallDescription("", "")).toBe(false);
});
