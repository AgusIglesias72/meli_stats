import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';

// ==================== USERS ====================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: bigint('user_id', { mode: 'number' }),
  email: text('email'),
  nickname: text('nickname'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  identification: text('identification'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ==================== STORES ====================
export const stores = pgTable('stores', {
  id: uuid('id').defaultRandom().primaryKey(),
  store_id: text('store_id').unique(),
  ml_user_id: bigint('ml_user_id', { mode: 'number' }),
  name: text('name'),
  access_token: text('access_token'),
  refresh_token: text('refresh_token'),
  token_expiry: timestamp('token_expiry', { withTimezone: true }),
  seller_first_name: text('seller_first_name'),
  seller_last_name: text('seller_last_name'),
  seller_email: text('seller_email'),
  seller_identification_number: text('seller_identification_number'),
  gsheets_api_key: text('gsheets_api_key'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ==================== STORE_USERS ====================
export const storeUsers = pgTable('store_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id),
  store_id: uuid('store_id').references(() => stores.id),
  role: text('role'), // 'owner' | 'admin' | 'editor' | 'viewer'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// ==================== ITEMS ====================
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  item_id: text('item_id'),
  user_id: uuid('user_id').references(() => users.id),
  store_id: uuid('store_id').references(() => stores.id),
  site_id: text('site_id'),
  title: text('title'),
  seller_id: text('seller_id'),
  category_id: text('category_id'),
  official_store_id: text('official_store_id'),
  price: numeric('price'),
  base_price: numeric('base_price'),
  regular_amount: numeric('regular_amount'),
  amount: numeric('amount'),
  currency_id: text('currency_id'),
  available_quantity: integer('available_quantity'),
  permalink: text('permalink'),
  thumbnail: text('thumbnail'),
  status: text('status'),
  sku: text('sku'),
  listing_type_id: text('listing_type_id'),
  shipping_mode: text('shipping_mode'),
  free_shipping: boolean('free_shipping'),
  shipping_logistic_type: text('shipping_logistic_type'),
  item_tags: text('item_tags'),
  installments_quantity: integer('installments_quantity'),
  meli_percentage_fee: numeric('meli_percentage_fee'),
  percentage_fee: numeric('percentage_fee'),
  financing_add_on_fee: numeric('financing_add_on_fee'),
  fixed_fee: numeric('fixed_fee'),
  sale_fee_amount: numeric('sale_fee_amount'),
  shipping_list_cost: numeric('shipping_list_cost'),
  shipping_discount_rate: numeric('shipping_discount_rate'),
  shipping_promoted_amount: numeric('shipping_promoted_amount'),
  promotion_id: text('promotion_id'),
  campaign_type: text('campaign_type'),
  meli_percentage_cashback: numeric('meli_percentage_cashback'),
  seller_percentage: numeric('seller_percentage'),
  last_updated: timestamp('last_updated', { withTimezone: true }),
});

// ==================== ORDERS ====================
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  store_id: text('store_id'),
  date_created: text('date_created'),
  status: text('status'),
  pack_id: text('pack_id'),
  buyer_name: text('buyer_name'),
  doc_number: text('doc_number'),
  item_id: text('item_id'),
  variation_id: text('variation_id'),
  seller_sku: text('seller_sku'),
  quantity: integer('quantity'),
  item_title: text('item_title'),
  unit_price: numeric('unit_price'),
  variation_attributes: text('variation_attributes'),
  shipping_id: text('shipping_id'),
  shipping_mode: text('shipping_mode'),
  shipping_logistic_type: text('shipping_logistic_type'),
  shipping_status: text('shipping_status'),
  shipping_amount: numeric('shipping_amount'),
  total_paid_amount: numeric('total_paid_amount'),
  transaction_amount: numeric('transaction_amount'),
  coupon_amount: numeric('coupon_amount'),
  net_received_amount: numeric('net_received_amount'),
  charge_shipping: numeric('charge_shipping'),
  charge_coupon: numeric('charge_coupon'),
  charge_flat_fee: numeric('charge_flat_fee'),
  charge_meli_percentage_fee: numeric('charge_meli_percentage_fee'),
  charge_tax_withholding_debitos_creditos: numeric('charge_tax_withholding_debitos_creditos'),
  charge_other_taxes: numeric('charge_other_taxes'),
  charge_uncategorized: numeric('charge_uncategorized'),
  financing_add_on_fee: numeric('financing_add_on_fee'),
  financing_fee: numeric('financing_fee'),
  charge_types: text('charge_types'),
  installments: integer('installments'),
  money_release_date: text('money_release_date'),
  buffer_date: text('buffer_date'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
});

// ==================== TRACKED ITEMS CONFIG ====================
export const trackedItemsConfig = pgTable('tracked_items_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id),
  store_id: uuid('store_id').references(() => stores.id),
  item_id: text('item_id'),
  notes: text('notes'),
  seller_id: text('seller_id'),
  seller_nickname: text('seller_nickname'),
  processing_status: text('processing_status'), // 'pending' | 'success' | 'error' | 'error_data'
  processing_message: text('processing_message'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// ==================== TRACKED ITEMS DATA ====================
export const trackedItemsData = pgTable('tracked_items_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  config_id: uuid('config_id').references(() => trackedItemsConfig.id),
  item_id: text('item_id'),
  site_id: text('site_id'),
  title: text('title'),
  seller_id: text('seller_id'),
  seller_nickname: text('seller_nickname'),
  category_id: text('category_id'),
  official_store_id: text('official_store_id'),
  price: numeric('price'),
  base_price: numeric('base_price'),
  currency_id: text('currency_id'),
  available_quantity: integer('available_quantity'),
  permalink: text('permalink'),
  thumbnail: text('thumbnail'),
  status: text('status'),
  regular_amount: numeric('regular_amount'),
  amount: numeric('amount'),
  brand: text('brand'),
  last_updated: timestamp('last_updated', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ==================== INVITATIONS ====================
export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  store_id: uuid('store_id').references(() => stores.id),
  email: text('email'),
  token: text('token').unique(),
  role: text('role'), // 'admin' | 'editor' | 'viewer'
  expires_at: timestamp('expires_at', { withTimezone: true }),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// ==================== PENDING SHEET SYNCS ====================
export const pendingSheetSyncs = pgTable('pending_sheet_syncs', {
  id: uuid('id').defaultRandom().primaryKey(),
  item_id: text('item_id'),
  item_data: jsonb('item_data'),
  status: text('status'), // 'pending' | 'processed' | 'failed'
  attempts: integer('attempts').default(0),
  last_error: text('last_error'),
  processed_at: timestamp('processed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ==================== IMPORT ERRORS ====================
export const importErrors = pgTable('import_errors', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id'),
  item_id: text('item_id'),
  error_message: text('error_message'),
  resolved: boolean('resolved').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// ==================== DIMENSIONS EXPORT CACHE ====================
export const dimensionsExportCache = pgTable('dimensions_export_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  store_id: text('store_id'),
  item_id: text('item_id'),
  variation_id: text('variation_id').default(''),
  last_exported_at: timestamp('last_exported_at', { withTimezone: true }).defaultNow(),
  last_updated_at: timestamp('last_updated_at', { withTimezone: true }),
  checksum: text('checksum'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('dimensions_export_cache_unique').on(table.store_id, table.item_id, table.variation_id),
]);
