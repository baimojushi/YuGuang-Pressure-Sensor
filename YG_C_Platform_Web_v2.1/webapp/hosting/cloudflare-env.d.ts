declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CARE_ACK_BRIDGE_SECRET?: string;
  }
}
