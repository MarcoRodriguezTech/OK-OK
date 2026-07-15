import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const marketMetadata = sqliteTable("market_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    avatarUrl: text("avatar_url"),
    bio: text("bio").notNull().default(""),
    location: text("location").notNull().default(""),
    preferredShopsJson: text("preferred_shops_json").notNull().default("[]"),
    preferredTopSize: text("preferred_top_size").notNull().default(""),
    preferredBottomSize: text("preferred_bottom_size").notNull().default(""),
    preferredShoeSize: text("preferred_shoe_size").notNull().default(""),
    styleTagsJson: text("style_tags_json").notNull().default("[]"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    brand: text("brand").notNull().default("Unbranded"),
    condition: text("condition").notNull().default("Pre-loved"),
    size: text("size").notNull().default("One size"),
    imageUrl: text("image_url").notNull(),
    imagesJson: text("images_json").notNull().default("[]"),
    createdAt: createdAt(),
  },
  (table) => [index("items_seller_idx").on(table.sellerId), index("items_category_idx").on(table.category)],
);

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("available"),
    minePrice: integer("mine_price"),
    stealPrice: integer("steal_price"),
    grabPrice: integer("grab_price"),
    startingBid: integer("starting_bid"),
    bidIncrement: integer("bid_increment"),
    currentBid: integer("current_bid"),
    currentHolderId: text("current_holder_id").references(() => users.id),
    currentWinnerId: text("current_winner_id").references(() => users.id),
    expiresAt: text("expires_at"),
    soldAt: text("sold_at"),
    soldPrice: integer("sold_price"),
    revision: integer("revision").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("listings_item_unique").on(table.itemId),
    index("listings_status_expiry_idx").on(table.status, table.expiresAt),
    index("listings_seller_idx").on(table.sellerId),
  ],
);

export const itemStateEvents = sqliteTable(
  "item_state_events",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    amount: integer("amount"),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    revision: integer("revision").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("events_listing_time_idx").on(table.listingId, table.createdAt)],
);

export const bids = sqliteTable(
  "bids",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    bidderId: text("bidder_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("bids_listing_amount_idx").on(table.listingId, table.amount)],
);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").references(() => listings.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("conversation_member_unique").on(table.conversationId, table.userId),
    index("conversation_member_user_idx").on(table.userId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    senderId: text("sender_id").references(() => users.id),
    body: text("body").notNull(),
    system: integer("system", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("messages_conversation_time_idx").on(table.conversationId, table.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    listingId: text("listing_id").references(() => listings.id),
    conversationId: text("conversation_id").references(() => conversations.id),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_time_idx").on(table.userId, table.createdAt)],
);

export const cartEntries = sqliteTable(
  "cart_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    section: text("section").notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("cart_user_listing_unique").on(table.userId, table.listingId),
    index("cart_user_section_idx").on(table.userId, table.section),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (table) => [index("reports_listing_idx").on(table.listingId)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("secured"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("transactions_listing_unique").on(table.listingId),
    index("transactions_buyer_idx").on(table.buyerId),
    index("transactions_seller_idx").on(table.sellerId),
  ],
);
