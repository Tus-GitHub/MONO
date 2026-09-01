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
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
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
