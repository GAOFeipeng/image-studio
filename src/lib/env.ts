import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("dev-only-change-me"),
  SESSION_COOKIE_NAME: z.string().default("image_studio_session"),
  ALLOW_REGISTRATION: z.string().default("true"),
  IMAGE_PROVIDER: z.string().default("openai-compatible"),
  IMAGE_API_BASE_URL: z.string().url().default("https://api.openai.com"),
  IMAGE_GENERATION_PATH: z.string().default("/v1/images/generations"),
  IMAGE_EDIT_PATH: z.string().default("/v1/images/edits"),
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_DEFAULT_MODEL: z.string().default("gpt-image-2"),
  IMAGE_DEFAULT_SIZE: z.string().default("1024x1024"),
  IMAGE_DEFAULT_QUALITY: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  IMAGE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(20),
});

export const env = envSchema.parse(process.env);

export function allowRegistration() {
  return env.ALLOW_REGISTRATION.toLowerCase() === "true";
}
