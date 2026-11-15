# iPhone PWA chat keyboard follow-up — 2026-11-15

The user reports that Chat moves upward when the iPhone installed PWA keyboard opens.
The intended behavior is an anchored chat header, independently scrolling messages and a
composer that stays inside the visible area without moving the whole document.

## Findings and changes

- The old viewport handler treated `window.innerHeight` as the fixed-layout height. With
  a keyboard-sized `innerHeight` and a nonzero visual viewport offset, it discarded the
  offset. The reproduction (layout 844, inner/visual height 400, offset 200) placed Chat
  at 0 instead of 200. Use the root layout viewport height and preserve keyboard panning.
- Chat locked only body overflow. Anchor the body and contain root overscroll while Chat
  is present; normal page scrolling returns when leaving Chat.
- `overflow: hidden` still allowed focus to scroll the entire chat container. In the
  landscape tools reproduction, the header moved 15 pixels above its shell. Use `clip`
  on the shell and let the composer shrink/scroll within the available area instead.
- Focus correction may reveal a field inside Chat's own scroller, but never scrolls the
  chat shell or document. The short encryption status line joins the existing compact
  keyboard header treatment; encryption warnings/actions stay available.
- No new dependencies, database changes, authentication changes or encryption changes.

## Automated evidence before deployment

- 13 focused viewport/manager regression tests passed; ESLint and the production build passed.
- 48 browser checks passed: Chromium and WebKit, browser and simulated standalone mode,
  using both retained local synthetic partners.
- Each run checks portrait keyboard panning, a larger offset beyond the layout edge,
  keyboard dismissal with focus retained, landscape, expanded message tools, rotation back,
  small/large phones, tablet, a real short browser viewport, blur/dismissal and route exit.
- In the regression case, the corrected chat/header top is 200; composer bottom is 592
  within the visible bottom of 600. The chat shell scroll offset remains zero.
- No JavaScript errors or failed requests in the passing runs. Draft text was cleared.

## Scope of evidence

Keyboard geometry is injected into isolated Playwright contexts; standalone display mode
is simulated. This tests layout responses, not a physical iPhone keyboard or installed iOS PWA.
WebKit local requests use an HTTP transport relay and omit the production CSP's HTTPS-upgrade
directive only on localhost (WebKit otherwise upgrades the HTTP QA server's assets to HTTPS).
Production CSP is unchanged. Production verification is recorded after release.

The browser behavior motivating these cases is documented in the
[VisualViewport reference](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
and [WebKit's keyboard viewport report](https://bugs.webkit.org/show_bug.cgi?id=191204).
Those reports do not establish the exact iOS version or behavior on the user's device.
