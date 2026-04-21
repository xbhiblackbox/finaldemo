import { pgTable, text, boolean, timestamp, integer, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accessKeys = pgTable("access_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").default("User"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxDevices: integer("max_devices").notNull().default(1),
  deviceFingerprints: text("device_fingerprints").array().default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Speeds up "active keys only" admin filters / sweeps
  activeIdx: index("access_keys_active_idx").on(t.active),
}));

export const reelsData = pgTable("reels_data", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  account: text("account").notNull(),
  postIndex: integer("post_index").notNull(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Hot path: GET /api/reels-data?account=xxx + upsert lookup by (account, post_index)
  accountPostIdx: index("reels_data_account_post_idx").on(t.account, t.postIndex),
}));
