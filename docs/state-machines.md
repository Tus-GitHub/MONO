# State machines and transition ownership

The application uses explicit lifecycle states for business processes, discriminated request
states for asynchronous work, and simple values for independent controls. Existing database
columns, URLs and device-storage formats remain compatible. No state-machine package is needed.

## Shared rules

- `src/lib/state/task.ts`: one current async owner, synchronous duplicate prevention,
  cancellation, and rejection of stale completions. `use-async-task.ts` couples that ownership
  to `idle | pending(phase) | success(data) | error(phase, message)` and cancels on teardown.
- `src/components/forms/pending-fields.tsx`: Server Action forms disable their submitted
  fields while pending. A response cannot clear edits made after the submitted snapshot.
- `src/lib/state/confirmation.ts`: `idle -> awaiting -> closing -> idle`. Every request
  resolves, including cancellation and unmount; acceptance waits for history cleanup.
- `src/lib/state/overlay.ts`: entrance/exit transitions ignore obsolete timers, and nested
  history entries close in order with at most one Back traversal per entry.
- `src/lib/date/permissions.ts`: shared date capabilities for planning, actuals, photos,
  reviews, memories and revisit decisions. Mutation checks run inside `withDateWrite` while
  the date row is locked, so a competing lifecycle transition cannot invalidate the check.

## App-wide inventory and disposition

| Workflow family | Transition authority and remediation |
| --- | --- |
| Credential login, OAuth and identity linking | Existing server validation, one-use OAuth state cookie and locked account linking retained. A signed cookie never substitutes for database session checks. |
| Sessions and account invalidation | Existing expiry, revocation, token-version and deleted-user predicates retained. `state/access.ts` names session validity and is reused by delivery eligibility. |
| Password reset and verification | Single-use, expiring capabilities remain transactionally claimed. `capabilityState` gives reset and invitation expiry one exact boundary; verification already uses a conditional `expiresAt > now` claim. |
| Onboarding | Existing `OnboardingStep` and route guards remain the authority over profile, connection and space-setup markers. Disconnecting can legitimately return a completed user to connection. |
| Couple membership and account closure | Existing serializable create/join/archive/delete transactions retained. `coupleState` names archived/deleted availability without a redundant stored status. |
| Invitations | Existing named invitation states now share capability expiry/consumption precedence. Revocation, acceptance and renewal retain their locked transactions. |
| Archive export and restoration | Existing server manifest, identity, session, destination and one-time-receipt checks retained. Client requests use async ownership; `archive/restore-state.ts` derives approval eligibility from the exact digest, deadline, consent and member role. Approval expiry has a bounded one-shot timer. |
| Date lifecycle | `date/lifecycle.ts` remains the transition table. Same-day draft finalization is represented explicitly. Reopening preserves first-start attribution/time, clears current completion, and recovery clears cancellation markers. No-op requests do not emit status events. |
| Planning and stale editors | Existing version-checked writes, URL step validation and optimistic activity lists retained. Pending forms freeze their snapshot and device drafts continue to reject incompatible server baselines. |
| Calendar promotion and overdue nudges | Existing timezone-based promotion and notification cooldown retained. These scheduling transitions do not manufacture date completion. |
| Actuals and activity order | All mutations recheck capability inside the date transaction. Competing plan-to-actual seeding commits once; concurrent inserts allocate distinct positions; reorder rejects duplicate IDs. |
| Review privacy and reveal | Existing pure `ReviewStage`, visibility filters, serialized submit/reopen/delete and reveal lock retained. Pending form protection complements the existing server lock. UI reveal animation remains separate from authorization. |
| Post-date checklist | Existing `buildPipeline` remains a parallel set of completion/waiting conditions, rather than an artificial mandatory sequence. |
| Memories | Save/reactivation, cover validation and deletion run under date ownership. Existing unique date-memory relation preserves identity when a removed memory is recreated. |
| Media staging and retention | Existing cleanup reservation before object writes and transactional reference handoff retained. Caption and best-photo mutations now recheck their photo under the date transaction. |
| Favorites and recommendation feedback | Shared optimistic tasks serialize clicks, reconcile success and roll back to the last displayed value. Favorite toggles use one authorized SQL update so concurrent partner toggles cannot collapse into one. |
| Expenses, inline editors and ordinary CRUD | Existing validation, authorization and action states retained. Shared pending protection prevents simultaneous edits/submissions in each form. Activity toolbars retain failed input and only clear the matching successfully saved value. |
| Reminder occurrences | `notifications/reminder-state.ts` names scheduled/due/sent/dismissed/expired and the rescheduling rule. Satisfied review/memory reminders are retired; the atomic claim rechecks ownership, date status and outstanding work before enqueuing. |
| Notification readership and partner activity | Existing read timestamps and per-member seen watermarks retained; these represent independent two-state visibility decisions. |
| Push delivery | Existing `DeliveryStatus` plus explicit transition table, bounded attempts and token-owned leases. Expired or missing processing leases are reclaimed or terminally failed; eligibility is checked immediately before provider delivery. |
| Storage cleanup | `jobs/lifecycle.ts` derives scheduled/ready/processing/failed from existing columns. Exhausted jobs without a lease are terminally retired instead of remaining stuck. |
| Upload queues | `images/upload-queue.ts` owns concurrency, queued cancellation and per-attempt signals. Retry gets a new identity even if old preparation has not settled. Every settlement releases its slot; teardown aborts work and releases previews. |
| Avatar, cover and quick-camera uploads | Shared async request ownership covers resizing, validation and HTTP progress. Timeouts/errors release pending state; stale/unmounted callbacks cannot replace newer results. Preview URLs are released. |
| Search and place selection | Search results/errors only commit while their request is current. Selection uses immediate single-flight ownership and cancellation on sheet teardown/close. Existing URL-driven history/Explore filters and debounced availability checks retained. |
| Photo pagination and viewers | Pagination uses synchronous ownership and handles failures without unhandled rejections or automatic retry loops. Existing cursor/deduplication, gesture and viewer-history models retained. Image state remounts when its source changes. |
| Draft hydration and unsaved protection | Draft state is bound to key/server identity; hydration cannot overwrite a newer edit. Dirty revisions distinguish the submitted snapshot from subsequent edits. Existing schema and age validation retained. |
| Browser push enrollment | Availability and enabling/disabling are named phases with one async owner. Service-worker readiness is bounded, failed disabling returns to on, and late startup work cannot overwrite a newer operation. |
| PWA installation and replacement | Installation consumes a prompt once, bounds browser promises and records dismissals consistently across instances/tabs. Invalid stored dismissal metadata is ignored. A replacement worker waits for the user's Refresh action; first installation still activates normally. |
| Connectivity, theme and viewport | Browser connectivity, theme choice and keyboard detection remain independent native/derived states. Offline copy no longer implies that every write is automatically replayed. |
| Toasts and small controls | Independent open/selected/visible values remain simple. Toast timers are cleared on dismissal and teardown. Tabs, calendar view, ratings and password visibility need no parallel lifecycle framework. |
| Provider caches, backoff, rate limiting and retry | Existing bounded TTL/pending caches, provider backoff, sliding windows and serializable retry remain covered by their focused tests. They are infrastructure policies rather than user workflow statuses. |
| Polling, route loading and section failures | Existing running/visibility gates, error boundaries and per-section result unions retained. The browser runner now waits for Windows to release its previous server socket between suites. |

## Regression coverage

- `src/lib/state/workflows.test.ts`: cancellation ownership, confirmation/history races,
  expiry, invalidation, dirty revisions, date permissions and worker/reminder transitions.
- `src/lib/images/upload-queue.test.ts`: retry during cancelled preparation, bounded
  concurrency, rejected work, queued cancellation and stale terminal callbacks.
- `src/lib/state/service-worker.test.ts` and `test/e2e/first-visit.mjs`: first installation
  preserves form work; replacement waits for Refresh and reloads exactly once.
- `test/integration/state-machines.test.ts`: concurrent seeding/order allocation/favorites,
  invalid recording states, same-day finalization/reopening, memory reactivation, cleanup
  exhaustion and obsolete reminder retirement on real PostgreSQL.
- `test/e2e/state-machines.mjs`: real pending forms, post-save draft restoration, upload
  cancellation/retry and rejected-activity recovery through the browser, API, local media and PostgreSQL.
- Existing authentication, archive, session, delivery, review, provider, settings, journey,
  pagination and responsive workflow suites continue to cover the retained machines.

Production push delivery and platform-specific install dialogs still require configured
providers and real-device activation checks described in `DEPLOY.md`.
