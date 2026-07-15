const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export const RUNTIME_MARKET_SCHEMA = `
CREATE TABLE IF NOT EXISTS market_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  preferred_shops_json TEXT NOT NULL DEFAULT '[]',
  preferred_top_size TEXT NOT NULL DEFAULT '',
  preferred_bottom_size TEXT NOT NULL DEFAULT '',
  preferred_shoe_size TEXT NOT NULL DEFAULT '',
  style_tags_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT false,
  joined_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  seller_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Unbranded',
  condition TEXT NOT NULL DEFAULT 'Pre-loved',
  size TEXT NOT NULL DEFAULT 'One size',
  image_url TEXT NOT NULL,
  images_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  mine_price INTEGER,
  steal_price INTEGER,
  grab_price INTEGER,
  starting_bid INTEGER,
  bid_increment INTEGER,
  current_bid INTEGER,
  current_holder_id TEXT REFERENCES users(id),
  current_winner_id TEXT REFERENCES users(id),
  expires_at TEXT,
  sold_at TEXT,
  sold_price INTEGER,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS item_state_events (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  amount INTEGER,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  bidder_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT REFERENCES listings(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversation_members (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id TEXT REFERENCES users(id),
  body TEXT NOT NULL,
  system INTEGER NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  listing_id TEXT REFERENCES listings(id),
  conversation_id TEXT REFERENCES conversations(id),
  read INTEGER NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cart_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  section TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'secured',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS listings_item_unique ON listings(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_member_unique ON conversation_members(conversation_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS cart_user_listing_unique ON cart_entries(user_id, listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_listing_unique ON transactions(listing_id);
`;

function isoAt(epoch: number, offset: number) {
  return new Date(epoch + offset).toISOString();
}

function insert(
  db: D1Database,
  table: string,
  columns: string[],
  values: unknown[],
) {
  const placeholders = columns.map(() => "?").join(", ");
  return db
    .prepare(
      `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    )
    .bind(...values);
}

function insertRows(
  db: D1Database,
  table: string,
  columns: string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  const maxBoundParameters = 100;
  const rowsPerStatement = Math.max(
    1,
    Math.floor(maxBoundParameters / columns.length),
  );
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
    const chunk = rows.slice(offset, offset + rowsPerStatement);
    const rowPlaceholders =
      "(" + columns.map(() => "?").join(", ") + ")";
    const placeholders = chunk.map(() => rowPlaceholders).join(", ");
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO " +
            table +
            " (" +
            columns.join(", ") +
            ") VALUES " +
            placeholders,
        )
        .bind(...chunk.flat()),
    );
  }
  return statements;
}

export async function ensureMarketSchema(db: D1Database) {
  const statements = RUNTIME_MARKET_SCHEMA.split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => db.prepare(statement));

  // Sites/D1 expects one statement per prepared query. Keep each batch small
  // enough for D1's statement limits while preserving idempotent startup.
  for (let offset = 0; offset < statements.length; offset += 50) {
    await db.batch(statements.slice(offset, offset + 50));
  }
}

export async function seedMarket(db: D1Database, now = new Date()) {
  const marker = await db
    .prepare("SELECT value FROM market_metadata WHERE key = ?")
    .bind("ok-ok-demo-seed-v1")
    .first<{ value: string }>();
  if (marker) return false;

  const t = now.getTime();
  const users = [
    ["u-ana", "anafinds", "Ana Reyes", "ana@example.com", "+63 917 442 1088", null, "Treasure hunter, denim defender, serial ukay regular.", "Quezon City", ["Rack Revival", "Second Spin Manila"], 1, isoAt(t, -240 * 24 * HOUR)],
    ["u-mika", "mikasrack", "Mika Santos", "mika@example.com", "+63 917 908 2214", null, "Curated leather, workwear, and pieces made to last.", "Makati City", ["Mika's Rack"], 1, isoAt(t, -410 * 24 * HOUR)],
    ["u-paolo", "paolopicks", "Paolo Cruz", "paolo@example.com", "+63 998 108 7002", null, "Old-school sportswear and everyday street staples.", "Pasig City", ["Paolo Picks", "Cubao Vintage"], 1, isoAt(t, -180 * 24 * HOUR)],
    ["u-jules", "julesukay", "Jules Lim", "jules@example.com", "+63 945 770 1880", null, "Here for the thrill of a good steal.", "Mandaluyong City", ["Ukay Central"], 0, isoAt(t, -92 * 24 * HOUR)],
    ["u-bea", "beathrifted", "Bea Navarro", "bea@example.com", "+63 966 150 3417", null, "Slow fashion, loud shoes.", "Manila", ["Sole Archive"], 1, isoAt(t, -305 * 24 * HOUR)],
  ] as const;

  const statements: D1PreparedStatement[] = insertRows(
    db,
    "users",
    ["id", "username", "display_name", "email", "phone", "avatar_url", "bio", "location", "preferred_shops_json", "preferred_top_size", "preferred_bottom_size", "preferred_shoe_size", "style_tags_json", "verified", "joined_at"],
    users.map((user) => [
      ...user.slice(0, 8),
      JSON.stringify(user[8]),
      "L",
      "32",
      "EU 39",
      JSON.stringify(["Vintage", "Workwear", "Y2K"]),
      ...user.slice(9),
    ]),
  );

  const items = [
    ["i-leather", "u-mika", "Caramel Leather Jacket", "Supple caramel leather with a gently worn-in finish, quilted lining, and clean brass hardware.", "Jackets", "Northfield", "Excellent", "M", "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=85", isoAt(t, -36 * HOUR)],
    ["i-denim", "u-paolo", "Sun-faded Denim Jacket", "Boxy vintage denim with natural fading at the seams and roomy patch pockets.", "Jackets", "Levi's", "Very good", "L", "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=85", isoAt(t, -28 * HOUR)],
    ["i-bandtee", "u-paolo", "Washed Tour Tee", "Soft charcoal cotton tour tee with a beautifully cracked front print. Authentic early-2000s feel.", "Shirts", "Tultex", "Good", "L", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85", isoAt(t, -19 * HOUR)],
    ["i-cap", "u-mika", "Forest Corduroy Cap", "Deep forest six-panel cap in fine-wale corduroy with an adjustable brass clasp.", "Caps", "Unbranded", "Excellent", "Adjustable", "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=85", isoAt(t, -18 * HOUR)],
    ["i-cargos", "u-paolo", "Olive Utility Cargos", "Relaxed fatigue pants with articulated knees and oversized utility pockets.", "Pants", "Rothco", "Very good", "32", "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1200&q=85", isoAt(t, -72 * HOUR)],
    ["i-loafers", "u-bea", "Oxblood Penny Loafers", "Hand-finished leather loafers with a stacked heel and fresh rubber half-soles.", "Shoes", "Sebago", "Excellent", "EU 39", "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=85", isoAt(t, -14 * HOUR)],
    ["i-hoodie", "u-ana", "Ash Grey Zip Hoodie", "Heavyweight loopback cotton, double zipper, and the perfect relaxed drape.", "Shirts", "Camber", "Very good", "XL", "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=85", isoAt(t, -10 * HOUR)],
    ["i-shorts", "u-bea", "Navy Track Shorts", "Lightweight nylon runners with mesh lining and a secure back pocket.", "Shorts", "Champion", "Excellent", "M", "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=85", isoAt(t, -96 * HOUR)],
  ] as const;

  statements.push(
    ...insertRows(
      db,
      "items",
      ["id", "seller_id", "title", "description", "category", "brand", "condition", "size", "image_url", "images_json", "created_at"],
      items.map((item) => [
        ...item.slice(0, 9),
        JSON.stringify([item[8]]),
        item[9],
      ]),
    ),
  );

  const listings = [
    ["l-leather", "i-leather", "u-mika", "bidding", "available", null, null, null, 1600, 200, 2400, "u-ana", "u-ana", isoAt(t, 5 * HOUR), null, null, 3, isoAt(t, -36 * HOUR), isoAt(t, -25 * MINUTE)],
    ["l-denim", "i-denim", "u-paolo", "msg", "available", 480, 650, 900, null, null, null, null, null, null, null, null, 0, isoAt(t, -28 * HOUR), isoAt(t, -28 * HOUR)],
    ["l-bandtee", "i-bandtee", "u-paolo", "msg", "mined", 350, 470, 690, null, null, null, "u-ana", "u-ana", isoAt(t, 17 * HOUR), null, null, 1, isoAt(t, -19 * HOUR), isoAt(t, -7 * HOUR)],
    ["l-cap", "i-cap", "u-mika", "msg", "stolen", 280, 380, 560, null, null, null, "u-jules", "u-jules", isoAt(t, 8 * MINUTE), null, null, 2, isoAt(t, -18 * HOUR), isoAt(t, -2 * MINUTE)],
    ["l-cargos", "i-cargos", "u-paolo", "msg", "sold", 620, 780, 980, null, null, null, "u-ana", "u-ana", null, isoAt(t, -26 * HOUR), 980, 1, isoAt(t, -72 * HOUR), isoAt(t, -26 * HOUR)],
    ["l-loafers", "i-loafers", "u-bea", "bidding", "available", null, null, null, 900, 100, 1300, "u-jules", "u-jules", isoAt(t, 9 * HOUR), null, null, 2, isoAt(t, -14 * HOUR), isoAt(t, -41 * MINUTE)],
    ["l-hoodie", "i-hoodie", "u-ana", "msg", "available", 520, 690, 920, null, null, null, null, null, null, null, null, 0, isoAt(t, -10 * HOUR), isoAt(t, -10 * HOUR)],
    ["l-shorts", "i-shorts", "u-bea", "bidding", "sold", null, null, null, 300, 50, 550, "u-ana", "u-ana", null, isoAt(t, -44 * HOUR), 550, 4, isoAt(t, -96 * HOUR), isoAt(t, -44 * HOUR)],
  ] as const;

  statements.push(
    ...insertRows(
      db,
      "listings",
      ["id", "item_id", "seller_id", "mode", "status", "mine_price", "steal_price", "grab_price", "starting_bid", "bid_increment", "current_bid", "current_holder_id", "current_winner_id", "expires_at", "sold_at", "sold_price", "revision", "created_at", "updated_at"],
      listings,
    ),
  );

  const events = [
    ["e-leather-1", "l-leather", "u-jules", "bid", 1800, "available", "available", 1, isoAt(t, -3 * HOUR)],
    ["e-leather-2", "l-leather", "u-bea", "bid", 2200, "available", "available", 2, isoAt(t, -70 * MINUTE)],
    ["e-leather-3", "l-leather", "u-ana", "bid", 2400, "available", "available", 3, isoAt(t, -25 * MINUTE)],
    ["e-bandtee-1", "l-bandtee", "u-ana", "mine", 350, "available", "mined", 1, isoAt(t, -7 * HOUR)],
    ["e-cap-1", "l-cap", "u-ana", "mine", 280, "available", "mined", 1, isoAt(t, -15 * HOUR)],
    ["e-cap-2", "l-cap", "u-jules", "steal", 380, "mined", "stolen", 2, isoAt(t, -2 * MINUTE)],
    ["e-cargos-1", "l-cargos", "u-ana", "grab", 980, "available", "sold", 1, isoAt(t, -26 * HOUR)],
    ["e-loafers-1", "l-loafers", "u-ana", "bid", 1100, "available", "available", 1, isoAt(t, -2 * HOUR)],
    ["e-loafers-2", "l-loafers", "u-jules", "bid", 1300, "available", "available", 2, isoAt(t, -41 * MINUTE)],
    ["e-shorts-1", "l-shorts", "u-ana", "settle", 550, "available", "sold", 4, isoAt(t, -44 * HOUR)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "item_state_events",
      ["id", "listing_id", "actor_id", "action", "amount", "from_status", "to_status", "revision", "created_at"],
      events,
    ),
  );

  const bids = [
    ["b-leather-1", "l-leather", "u-jules", 1800, isoAt(t, -3 * HOUR)],
    ["b-leather-2", "l-leather", "u-bea", 2200, isoAt(t, -70 * MINUTE)],
    ["b-leather-3", "l-leather", "u-ana", 2400, isoAt(t, -25 * MINUTE)],
    ["b-loafers-1", "l-loafers", "u-ana", 1100, isoAt(t, -2 * HOUR)],
    ["b-loafers-2", "l-loafers", "u-jules", 1300, isoAt(t, -41 * MINUTE)],
    ["b-shorts-1", "l-shorts", "u-jules", 450, isoAt(t, -50 * HOUR)],
    ["b-shorts-2", "l-shorts", "u-ana", 550, isoAt(t, -45 * HOUR)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "bids",
      ["id", "listing_id", "bidder_id", "amount", "created_at"],
      bids,
    ),
  );

  const conversations = [
    ["c-ana-paolo", "l-cargos", isoAt(t, -25 * HOUR)],
    ["c-ana-bea", "l-shorts", isoAt(t, -43 * HOUR)],
    ["c-ana-mika", "l-leather", isoAt(t, -4 * HOUR)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "conversations",
      ["id", "listing_id", "updated_at"],
      conversations,
    ),
  );
  const memberships = [
    ["cm-ana-paolo-a", "c-ana-paolo", "u-ana"], ["cm-ana-paolo-p", "c-ana-paolo", "u-paolo"],
    ["cm-ana-bea-a", "c-ana-bea", "u-ana"], ["cm-ana-bea-b", "c-ana-bea", "u-bea"],
    ["cm-ana-mika-a", "c-ana-mika", "u-ana"], ["cm-ana-mika-m", "c-ana-mika", "u-mika"],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "conversation_members",
      ["id", "conversation_id", "user_id"],
      memberships,
    ),
  );

  const messages = [
    ["m-cargos-system", "c-ana-paolo", null, "Purchase secured: Olive Utility Cargos. Buyer: Ana Reyes (+63 917 442 1088). Seller and buyer can arrange delivery here. Keep payment and shipping details in this chat, confirm the total before sending, and use Report if anything feels off.", 1, isoAt(t, -26 * HOUR)],
    ["m-cargos-1", "c-ana-paolo", "u-paolo", "Hi Ana! I can ship this tomorrow morning or arrange a Pasig pickup.", 0, isoAt(t, -25 * HOUR)],
    ["m-shorts-system", "c-ana-bea", null, "Auction won: Navy Track Shorts. Buyer: Ana Reyes (+63 917 442 1088). The final bid is ₱550. Use this thread to agree on delivery and payment, then keep your confirmation for reference.", 1, isoAt(t, -44 * HOUR)],
    ["m-shorts-1", "c-ana-bea", "u-ana", "Thanks, Bea! Could we do a weekend meetup?", 0, isoAt(t, -43 * HOUR)],
    ["m-leather-1", "c-ana-mika", "u-ana", "Hello! May I ask for the shoulder measurement?", 0, isoAt(t, -5 * HOUR)],
    ["m-leather-2", "c-ana-mika", "u-mika", "Sure! It is 18.5 inches across, laid flat.", 0, isoAt(t, -4 * HOUR)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "messages",
      ["id", "conversation_id", "sender_id", "body", "system", "created_at"],
      messages,
    ),
  );

  const notifications = [
    ["n-cap-stolen", "u-ana", "steal", "Jules stole your spot", "Forest Corduroy Cap was stolen. You can steal it back before the timer ends.", "l-cap", null, 0, isoAt(t, -2 * MINUTE)],
    ["n-leather-leading", "u-ana", "bid", "You are leading", "Your ₱2,400 bid on Caramel Leather Jacket is currently highest.", "l-leather", "c-ana-mika", 0, isoAt(t, -25 * MINUTE)],
    ["n-cargos-won", "u-ana", "won", "Grab secured", "Olive Utility Cargos is locked in your cart. Message Paolo to arrange delivery.", "l-cargos", "c-ana-paolo", 1, isoAt(t, -26 * HOUR)],
    ["n-shorts-won", "u-ana", "won", "You won the auction", "Navy Track Shorts is secured at ₱550.", "l-shorts", "c-ana-bea", 1, isoAt(t, -44 * HOUR)],
    ["n-bea-outbid", "u-bea", "outbid", "You were outbid", "Ana placed a ₱2,400 bid on Caramel Leather Jacket.", "l-leather", null, 0, isoAt(t, -25 * MINUTE)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "notifications",
      ["id", "user_id", "kind", "title", "body", "listing_id", "conversation_id", "read", "created_at"],
      notifications,
    ),
  );

  const carts = [
    ["cart-ana-leather", "u-ana", "l-leather", "active", "Bidded", isoAt(t, -25 * MINUTE), isoAt(t, -25 * MINUTE)],
    ["cart-ana-bandtee", "u-ana", "l-bandtee", "active", "Mined", isoAt(t, -7 * HOUR), isoAt(t, -7 * HOUR)],
    ["cart-ana-cap", "u-ana", "l-cap", "lost", "Lost", isoAt(t, -15 * HOUR), isoAt(t, -2 * MINUTE)],
    ["cart-ana-cargos", "u-ana", "l-cargos", "secured", "Grabbed", isoAt(t, -26 * HOUR), isoAt(t, -26 * HOUR)],
    ["cart-ana-shorts", "u-ana", "l-shorts", "secured", "Won", isoAt(t, -44 * HOUR), isoAt(t, -44 * HOUR)],
    ["cart-jules-cap", "u-jules", "l-cap", "active", "Stolen", isoAt(t, -15 * HOUR), isoAt(t, -2 * MINUTE)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "cart_entries",
      ["id", "user_id", "listing_id", "section", "status", "created_at", "updated_at"],
      carts,
    ),
  );

  const transactions = [
    ["tx-cargos", "l-cargos", "u-ana", "u-paolo", 980, "grab", "secured", isoAt(t, -26 * HOUR)],
    ["tx-shorts", "l-shorts", "u-ana", "u-bea", 550, "bid", "secured", isoAt(t, -44 * HOUR)],
  ] as const;
  statements.push(
    ...insertRows(
      db,
      "transactions",
      ["id", "listing_id", "buyer_id", "seller_id", "amount", "source", "status", "created_at"],
      transactions,
    ),
  );

  statements.push(
    insert(db, "reports", ["id", "reporter_id", "listing_id", "reason", "details", "status", "created_at"], ["r-demo", "u-jules", "l-denim", "Item details", "Requested a clearer photo of the care label.", "resolved", isoAt(t, -20 * HOUR)]),
    insert(db, "market_metadata", ["key", "value", "updated_at"], ["ok-ok-demo-seed-v1", "complete", now.toISOString()]),
  );

  // D1 batches are transactional: a failed seed does not leave a half-built demo.
  await db.batch(statements);
  return true;
}
