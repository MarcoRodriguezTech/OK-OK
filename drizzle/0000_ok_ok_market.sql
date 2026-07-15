CREATE TABLE IF NOT EXISTS "market_metadata" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "display_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "avatar_url" text,
  "bio" text DEFAULT '' NOT NULL,
  "location" text DEFAULT '' NOT NULL,
  "preferred_shops_json" text DEFAULT '[]' NOT NULL,
  "preferred_top_size" text DEFAULT '' NOT NULL,
  "preferred_bottom_size" text DEFAULT '' NOT NULL,
  "preferred_shoe_size" text DEFAULT '' NOT NULL,
  "style_tags_json" text DEFAULT '[]' NOT NULL,
  "verified" integer DEFAULT false NOT NULL,
  "joined_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
  "id" text PRIMARY KEY NOT NULL,
  "seller_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "category" text NOT NULL,
  "brand" text DEFAULT 'Unbranded' NOT NULL,
  "condition" text DEFAULT 'Pre-loved' NOT NULL,
  "size" text DEFAULT 'One size' NOT NULL,
  "image_url" text NOT NULL,
  "images_json" text DEFAULT '[]' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_seller_idx" ON "items" ("seller_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_category_idx" ON "items" ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listings" (
  "id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL,
  "seller_id" text NOT NULL,
  "mode" text NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "mine_price" integer,
  "steal_price" integer,
  "grab_price" integer,
  "starting_bid" integer,
  "bid_increment" integer,
  "current_bid" integer,
  "current_holder_id" text,
  "current_winner_id" text,
  "expires_at" text,
  "sold_at" text,
  "sold_price" integer,
  "revision" integer DEFAULT 0 NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("current_holder_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("current_winner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "listings_item_unique" ON "listings" ("item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_status_expiry_idx" ON "listings" ("status","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_seller_idx" ON "listings" ("seller_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_state_events" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text NOT NULL,
  "actor_id" text,
  "action" text NOT NULL,
  "amount" integer,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "revision" integer NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_listing_time_idx" ON "item_state_events" ("listing_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bids" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text NOT NULL,
  "bidder_id" text NOT NULL,
  "amount" integer NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bids_listing_amount_idx" ON "bids" ("listing_id","amount");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_member_unique" ON "conversation_members" ("conversation_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_member_user_idx" ON "conversation_members" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "sender_id" text,
  "body" text NOT NULL,
  "system" integer DEFAULT false NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_time_idx" ON "messages" ("conversation_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "listing_id" text,
  "conversation_id" text,
  "read" integer DEFAULT false NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_time_idx" ON "notifications" ("user_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "listing_id" text NOT NULL,
  "section" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cart_user_listing_unique" ON "cart_entries" ("user_id","listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_user_section_idx" ON "cart_entries" ("user_id","section");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_id" text NOT NULL,
  "listing_id" text NOT NULL,
  "reason" text NOT NULL,
  "details" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_listing_idx" ON "reports" ("listing_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text NOT NULL,
  "buyer_id" text NOT NULL,
  "seller_id" text NOT NULL,
  "amount" integer NOT NULL,
  "source" text NOT NULL,
  "status" text DEFAULT 'secured' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_listing_unique" ON "transactions" ("listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_buyer_idx" ON "transactions" ("buyer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_seller_idx" ON "transactions" ("seller_id");
