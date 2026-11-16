# Chat connection recovery

The user reported repeated connecting/reconnecting in both match chat and normal encrypted chat.

## Changes

- Normal chat retries transient read failures with a bounded delay, shares one in-flight refresh, and keeps the existing messages/composer. A single short interruption no longer displays a reconnect alert. Persistent failures remain visible and recover automatically; authentication/access errors are not treated as successful updates.
- HTTP errors retain their status, including HTML gateway failures. Message writes are not automatically retried, preserving existing explicit send/idempotency behavior.
- Polling does not abort a healthy background request on every visibility change. It resumes when the browser returns online and does not start overlapping requests.
- Game chat retries signaling reads independently from the peer transport. Failed background requests no longer close an open channel or clear pending messages. Brief peer disconnects have a recovery grace period; successful reconnection cancels a rebuild.
- Recovery processes the latest peer greeting in a batch instead of recreating a connection for every historical session. Repeated offers can resend the existing answer.
- Shared-call game chat distinguishes a partner leaving from transport failure. It tolerates delayed presence for 45 seconds without repeatedly detaching/rejoining the call channel; an explicit leave still updates immediately. Restoring from the back/forward cache starts a fresh game-chat session.
- No chat encryption, message storage, retention, call-media permissions, provider credentials or billing changes. Game text remains transient and peer-encrypted.

## Verification

- 12 focused unit tests passed: transient read retries, HTML gateway status, abort during backoff, no retries on authorization failures or message writes, persistent outage reporting, retry caps, message-version merging and call-channel capability negotiation.
- Initial local browser checks passed normal-chat delivery after short failures, persistent error/recovery, repeated game signaling failures without replacing the peer, a brief disconnected event and two real player reloads. Test click synchronization was adjusted before the complete final run.
- Final merged production build passed (99 routes, largest local trace 4.08 MiB); changed-file ESLint and TypeScript passed. Preserved the concurrent duplicate-display-name release.
- All seven browser groups passed in `.postgres-test/reconnect-fix/.postgres-test/e2e/2788fb14f4ff5ddb/results.json`, including in-call game chat with 12 seconds of dropped presence packets and repeated signaling API failures. Chat still delivered both ways and the call peer stayed connected. No browser JavaScript errors; disposable local users and space were removed.
- Published `2e7eb56f87adb97910725d90b5d2ed81d292d915`; push to main succeeded. Production deployment `dpl_jprD3m9Hbgu2Fn8dqgKiUh7mq92K` is READY on https://mono-kappa-beryl.vercel.app.
- All seven live groups passed in `.postgres-test/reconnect-fix/.postgres-test/chat-stability-live/live-86b079850c20/results.json`: normal encrypted chat retries and delivery, sustained outage/recovery, standalone channel preservation with two-way messages during HTTP failures, a simulated brief WebRTC disconnected event, two actual player reloads, shared-call game chat with delayed presence/API outages, and no uncaught JavaScript errors. Tests used isolated Chrome contexts and synthetic microphone audio, not physical phone routing or OS background suspension.
- Both disposable live users and their space were removed. No existing customer data was changed. Production health returned HTTP200/database up; the scoped deployment error/fatal log query returned no entries. Existing browser/PWA windows need a reload to execute the new client code.
