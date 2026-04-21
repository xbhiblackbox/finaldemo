import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

// Connection pool tuned for high concurrency.
// - max: 20 concurrent connections (Postgres default limit is 100; leaves headroom)
// - idleTimeoutMillis: close idle clients after 30s to free DB resources
// - connectionTimeoutMillis: fail fast (5s) instead of hanging when DB is down
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export async function bootstrapSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS access_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        label text DEFAULT 'User',
        active boolean NOT NULL DEFAULT true,
        expires_at timestamptz,
        max_devices integer NOT NULL DEFAULT 1,
        device_fingerprints text[] DEFAULT '{}'::text[],
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS access_keys_active_idx ON access_keys(active)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reels_data (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account text NOT NULL,
        post_index integer NOT NULL,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS reels_data_account_post_idx ON reels_data(account, post_index)`);

    const seedKey = process.env.SEED_ACCESS_KEY;
    const seedLabel = process.env.SEED_ACCESS_KEY_LABEL || "Owner";
    if (seedKey) {
      await client.query(
        `INSERT INTO access_keys (key, label, active, max_devices)
         VALUES ($1, $2, true, 1)
         ON CONFLICT (key) DO NOTHING`,
        [seedKey, seedLabel]
      );
    }
    console.log("[db] Schema bootstrap complete");
  } catch (err) {
    console.error("[db] Bootstrap error:", err);
  } finally {
    client.release();
  }
}
