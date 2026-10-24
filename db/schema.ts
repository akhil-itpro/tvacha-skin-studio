import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
  ownerId: text('owner_id').primaryKey(), createdAt: text('created_at').notNull(),
  ageConfirmed: integer('age_confirmed', { mode: 'boolean' }).notNull().default(false), quizJson: text('quiz_json'),
});
export const consents = sqliteTable('consents', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), purpose: text('purpose').notNull(),
  granted: integer('granted').notNull(), version: text('version').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('consents_owner').on(t.ownerId)]);
export const scans = sqliteTable('scans', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), createdAt: text('created_at').notNull(),
  quizJson: text('quiz_json').notNull(), resultJson: text('result_json'), source: text('source').notNull(),
  model: text('model'), message: text('message').notNull().default(''),
}, t => [index('scans_owner_date').on(t.ownerId, t.createdAt)]);
export const routineTicks = sqliteTable('routine_ticks', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), date: text('date').notNull(),
  slot: text('slot').notNull(), step: text('step').notNull(), done: integer('done').notNull(),
}, t => [uniqueIndex('tick_unique').on(t.ownerId, t.date, t.slot, t.step)]);
export const shelfItems = sqliteTable('shelf_items', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), name: text('name').notNull(),
  step: text('step').notNull(), productId: text('product_id'), hasActive: integer('has_active').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, t => [index('shelf_owner').on(t.ownerId)]);
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), dataJson: text('data_json').notNull(), active: integer('active').notNull().default(1), updatedAt: text('updated_at').notNull(),
});
export const rules = sqliteTable('rules', { concern: text('concern').primaryKey(), dataJson: text('data_json').notNull() });
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), name: text('name').notNull(),
  properties: text('properties').notNull().default('{}'), createdAt: text('created_at').notNull(),
}, t => [index('events_name_date').on(t.name, t.createdAt), index('events_owner').on(t.ownerId)]);
export const userRoles = sqliteTable('user_roles', { ownerId: text('owner_id').primaryKey(), role: text('role').notNull() });
export const progressPhotos = sqliteTable('progress_photos', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), scanId: text('scan_id').notNull(),
  objectKey: text('object_key').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('photos_owner').on(t.ownerId)]);
export const waitlist = sqliteTable('waitlist', {
  ownerId: text('owner_id').primaryKey(), email: text('email').notNull(), price: text('price'), referral: text('referral'), createdAt: text('created_at').notNull(),
});
export const scanReservations = sqliteTable('scan_reservations', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), day: text('day').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('reservations_day').on(t.day), index('reservations_owner_day').on(t.ownerId, t.day)]);
// Anonymous aggregate survives account deletion so deletion cannot reset the global cost cap.
export const scanDailyUsage = sqliteTable('scan_daily_usage', { day:text('day').primaryKey(), count:integer('count').notNull().default(0) });
export const invites = sqliteTable('invites', {
  ownerId:text('owner_id').primaryKey(), code:text('code').notNull().unique(), referredBy:text('referred_by'), createdAt:text('created_at').notNull(),
});
export const referralSignups = sqliteTable('referral_signups', {
  ownerId:text('owner_id').primaryKey(), code:text('code').notNull(), createdAt:text('created_at').notNull(),
});
