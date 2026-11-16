// Both addresses belong to the same project. Keep the original PWA working in place.
export const AMOR_ORIGIN = "https://amor-together.vercel.app";
export const LEGACY_ORIGIN = "https://mono-kappa-beryl.vercel.app";

export function isAppOrigin(origin: string | null, configuredUrl: string): boolean {
  const configured = new URL(configuredUrl).origin;
  if (origin === configured) return true;
  return (configured === AMOR_ORIGIN || configured === LEGACY_ORIGIN)
    && (origin === AMOR_ORIGIN || origin === LEGACY_ORIGIN);
}
