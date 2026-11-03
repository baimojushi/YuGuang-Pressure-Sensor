import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// One durable aggregate per authenticated Site owner. CAS versioning makes all
// queue, pairing and receipt transitions atomic across parallel clients.
export const households = sqliteTable('households', {
  ownerId: text('owner_id').primaryKey(),
  payload: text('payload').notNull(),
  version: integer('version').notNull().default(0),
  deviceKeyHash: text('device_key_hash').notNull().unique(),
  updatedAt: integer('updated_at').notNull(),
});
// V2 keeps the applied legacy schema intact and starts a separate live space.
export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  version: integer('version').notNull().default(0),
});
