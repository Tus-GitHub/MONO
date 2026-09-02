---
description: Build; if it succeeds, commit and push to origin main
---

Run this project's publish workflow, in order. Do not skip or reorder steps.

1. Update `memory.md` so it reflects the current state of the work (see `CLAUDE.md` rules 1–2).
2. Run `npm run build`.
3. If the build **fails**: show me the errors and stop. Do **not** `git add`, commit, or push.
4. If the build **succeeds**:
   - `git add -A`
   - `git commit` with a concise message summarising what changed, keeping the trailer
     `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
   - `git push` to `origin main`
5. Report the commit hash and whether the push succeeded.
