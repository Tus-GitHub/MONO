/**
 * The three theme choices. "system" follows `prefers-color-scheme`; the other two pin it via a
 * `data-theme` attribute on <html> (see `globals.css`). Pure — shared by the toggle, the
 * no-flash boot script, the applier, and the settings action.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";

/** localStorage key the boot script and the applier read/write. */
export const THEME_STORAGE_KEY = "mono:theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export const THEME_LABEL: Record<Theme, string> = {
  system: "Match my device",
  light: "Light",
  dark: "Dark",
};

export const THEME_HINT: Record<Theme, string> = {
  system: "Follows your device's light or dark setting.",
  light: "Always the light palette.",
  dark: "Always the dark palette.",
};

/**
 * The `<script>` body injected into <head> so a returning visitor never sees a wrong-theme
 * flash. It only reads localStorage — the server-persisted value is reconciled after mount by
 * `<ThemeApplier>`. Kept tiny and dependency-free; stringified verbatim into the page.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
