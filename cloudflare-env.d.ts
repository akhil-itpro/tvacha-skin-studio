declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_DATA_POLICY?: string;
    GROQ_API_KEY?: string;
    GROQ_MODEL?: string;
    GROQ_ZDR_ENABLED?: string;
    PHOTO_AI_PROVIDER?: string;
    ADMIN_USER_IDS?: string;
    ADMIN_EMAILS?: string;
  }
}
