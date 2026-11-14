# Live completion-to-memory audit — 2026-11-14

Continued the retained `LIVE QA Events 7a9b30f6e0` dates from the preceding audit.
Chromium used owner phone/partner standalone-PWA profiles; WebKit swapped these roles.
All writes went through the production UI, scoped to the two synthetic users and their dates.
The user's Keep test records instruction remains in force.

Both engines verified completion and automatic partner status updates, expenses recorded by
each partner (INR 600 + 1200), actual recap and copying both planned events into actuals,
independent 8/10 and 9/10 reviews with private reflections before the second submission,
and automatic shared review reveal. Both users' reflections became visible after submission.
Both saved a written memory with a selected cover photo and favourite flag.
Production SQL confirmed COMPLETED status, 180000 minor units of expenses/actual spend,
two actual events, two submitted reviews, and a favourite memory with a cover on each date.
Forms were checked at 320×700, 390×844 and 844×390 landscape.

The live audit found two display defects:

1. Money-entry fields hard-coded `$` for INR dates. Expense, recap, actual-event cost and
   saved-plan budget inputs now use the selected currency's symbol.
2. Memories journal/favourite cards ignored the saved memory title and opened the date.
   These cards now use the memory title and open its detail page. Shared date cards retain
   their date behavior outside Memories.

No schema or dependency change is needed by these fixes. Build/TypeScript and targeted ESLint
passed before integrating concurrent main commit 9b571a9 (chat/calls/games); a fresh build
and the combined production build/TypeScript passed after that integration.

Published `dbe59362be497df966a146bb2169cee7a6202145`; production deployment
`dpl_KfdgghnBSWnpeF5atwmNVZ38rHBs` READY at https://mono-kappa-beryl.vercel.app.
Final read-back passed for all four engine/user combinations: Chromium owner/partner and
WebKit owner/partner, with phone/PWA roles swapped. Each verified completed status, both
expenses, both revealed reflections, rupee symbols in expense/recap inputs, both actual
events, memory title → detail navigation, story/photo loading, favourite listing, and mobile/
landscape fit. Production error/fatal logs had no entries in the test window.
Evidence: `.screenshots/live-post-date-7a9b30f6e0/deployed-readback.json`.

Evidence: `.screenshots/live-post-date-7a9b30f6e0/` and the scoped production SQL read-back.
Automated PWA/Safari profiles do not constitute physical iPhone or home-screen testing.
The first automation used the wrong confirmation-dialog role and an exact-text matcher that
excluded author labels in the review; correcting those selectors confirmed functional behavior.
