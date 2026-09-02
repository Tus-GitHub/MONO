import { z } from "zod";

/**
 * Validated, typed access to environment configuration.
 *
 * Import this instead of reading `process.env` directly (the one deliberate exception is
 * `src/middleware.ts`, which runs on the Edge runtime and reads a couple of vars directly).
 * A missing or malformed value fails fast at startup with a readable message.
 */
const booleanish = z
  .string()
  .transform((value) => value === "1" || value.toLowerCase() === "true")
  .pipe(z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().optional(),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_COOKIE_NAME: z.string().min(1).default("mono_session"),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),

  APP_URL: z.string().url().default("http://localhost:3000"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().default("./.storage"),
  STORAGE_PUBLIC_PREFIX: z.string().default("/media"),

  // S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO …). Required
  // only when STORAGE_DRIVER=s3. The bucket must be **private** — objects are served solely
  // through the authorised `/media` route, never a public URL.
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""), // set for R2 / B2 / MinIO; leave blank for AWS
  S3_FORCE_PATH_STYLE: booleanish.optional(),

  // Image pipeline: "sharp" generates real thumbnails + blur placeholders; "noop" stores the
  // original for every variant (tests / environments without libvips).
  IMAGE_PROCESSOR: z.enum(["sharp", "noop"]).default("sharp"),

  EMAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
  EMAIL_FROM: z.string().default("MONO <no-reply@mono.local>"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_ENABLED: booleanish.optional(),

  // Place discovery — an external provider is optional; MONO falls back to the couple's
  // own saved places + custom entries when none is configured.
  PLACE_PROVIDER: z.enum(["none", "google"]).default("none"),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),

  // Web Push (VAPID). Optional — with none set, `getPushChannel()` returns the no-op channel
  // and in-app notifications carry everything. Generate a pair with `npm run vapid`.
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:hello@mono.app"),
  // Same public key, exposed to the browser so it can subscribe.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(""),
});

// `next build` runs with NODE_ENV=production but doesn't need real secrets — only the running
// server does. Skip the strict checks during the build phase so a dev `.env` can still build.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Extra guards that only bite when a *running* production server starts, so a misconfigured
 * deploy fails fast instead of shipping a dev secret or a local-only storage backend.
 * Dev/test — and the build — are left permissive.
 */
const productionSafe = schema.superRefine((v, ctx) => {
  if (v.NODE_ENV !== "production" || isBuildPhase) return;

  if (/dev-insecure|change-?me|example|test-secret/i.test(v.AUTH_SECRET)) {
    ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "looks like a placeholder — set a real 32+ char secret in production" });
  }
  if (/localhost|127\.0\.0\.1/.test(v.DATABASE_URL)) {
    ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "points at localhost in production" });
  }
  if (v.APP_URL.startsWith("http://") && !v.APP_URL.includes("localhost")) {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must be https:// in production" });
  }
  if (v.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when STORAGE_DRIVER=s3" });
    }
  }
});

function loadEnv() {
  const parsed = productionSafe.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  // A soft nudge, not a hard failure: photos on a read-only prod FS will vanish on redeploy.
  if (
    parsed.data.NODE_ENV === "production" &&
    !isBuildPhase &&
    parsed.data.STORAGE_DRIVER === "local"
  ) {
    console.warn(
      "[env] STORAGE_DRIVER=local in production — uploaded photos will not persist. Set STORAGE_DRIVER=s3.",
    );
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

/** Whether Google sign-in has real credentials wired up. */
export const googleOAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Whether an external place provider is configured. */
export const placeProviderConfigured =
  env.PLACE_PROVIDER === "google" && Boolean(env.GOOGLE_PLACES_API_KEY);
