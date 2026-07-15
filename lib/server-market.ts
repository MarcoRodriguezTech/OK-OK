import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { ensureMarketSchema, seedMarket } from "@/lib/market-seed";
import {
  MARKET_CATEGORIES,
  type CartStatus,
  type ListingStatus,
  type MarketActionRequest,
  type MarketApiResponse,
  type MarketCategory,
  type MarketState,
  type NotificationKind,
} from "@/lib/market-types";

const DEMO_VIEWER_ID = "u-ana";
const DAY_MS = 24 * 60 * 60 * 1000;
const STEAL_MS = 10 * 60 * 1000;

type RawListing = {
  id: string;
  item_id: string;
  seller_id: string;
  mode: "msg" | "bidding";
  status: ListingStatus;
  mine_price: number | null;
  steal_price: number | null;
  grab_price: number | null;
  starting_bid: number | null;
  bid_increment: number | null;
  current_bid: number | null;
  current_holder_id: string | null;
  current_winner_id: string | null;
  expires_at: string | null;
  sold_at: string | null;
  sold_price: number | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export class MarketError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

let initialization: Promise<void> | null = null;

const profileColumnDefinitions = {
  preferred_top_size: "TEXT NOT NULL DEFAULT ''",
  preferred_bottom_size: "TEXT NOT NULL DEFAULT ''",
  preferred_shoe_size: "TEXT NOT NULL DEFAULT ''",
  style_tags_json: "TEXT NOT NULL DEFAULT '[]'",
} as const;

function database() {
  const db = env.DB as D1Database | undefined;
  if (!db) {
    throw new MarketError(
      "The OK-OK market database is unavailable. Configure the D1 binding as DB.",
      503,
    );
  }
  return db;
}

async function ensureProfileColumns(db: D1Database) {
  const existing = await db
    .prepare("PRAGMA table_info(users)")
    .all<{ name: string }>();
  const names = new Set(existing.results.map((column) => column.name));
  for (const [name, definition] of Object.entries(profileColumnDefinitions)) {
    if (names.has(name)) continue;
    try {
      await db
        .prepare("ALTER TABLE users ADD COLUMN " + name + " " + definition)
        .run();
      names.add(name);
    } catch (error) {
      // A second cold-starting isolate may have added the same column between
      // the PRAGMA and ALTER. Recheck durable state before surfacing the error.
      const refreshed = await db
        .prepare("PRAGMA table_info(users)")
        .all<{ name: string }>();
      if (!refreshed.results.some((column) => column.name === name)) throw error;
      names.add(name);
    }
  }
}

export async function ensureMarketReady() {
  if (!initialization) {
    initialization = (async () => {
      const db = database();
      try {
        await db
          .prepare("SELECT 1 AS ready FROM market_metadata LIMIT 1")
          .first<{ ready: number }>();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message +
              (error.cause instanceof Error ? " " + error.cause.message : "")
            : String(error);
        if (!message.toLowerCase().includes("no such table")) throw error;
        await ensureMarketSchema(db);
      }
      await seedMarket(db);
      await ensureProfileColumns(db);
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

export async function resolvePlatformViewer(
  emailValue: string,
  fullName: string | null,
) {
  await ensureMarketReady();
  const email = emailValue.trim().toLowerCase();
  const existing = await database()
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const localPart = email.split("@")[0] || "member";
  const usernameBase =
    localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 28) ||
    "member";
  const username =
    usernameBase + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  const displayName =
    fullName?.trim() ||
    localPart
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") ||
    "OK-OK Member";
  const userId = id("user");
  await database()
    .prepare(
      "INSERT INTO users (id, username, display_name, email, phone, avatar_url, bio, location, preferred_shops_json, verified, joined_at) VALUES (?, ?, ?, ?, '', NULL, '', '', '[]', 1, ?)",
    )
    .bind(userId, username, displayName, email, new Date().toISOString())
    .run();
  return userId;
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function asMoney(value: unknown, label: string) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new MarketError(`${label} must be a positive whole-peso amount.`);
  }
  return amount;
}

function requiredText(value: unknown, label: string, max = 2000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketError(`${label} is required.`);
  }
  return value.trim().slice(0, max);
}

function parseJsonList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

async function requireUser(userId: string) {
  const row = await database()
    .prepare("SELECT id, display_name FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; display_name: string }>();
  if (!row) throw new MarketError("User not found.", 404);
  return row;
}

async function requireListing(listingId: string) {
  const listing = await database()
    .prepare("SELECT * FROM listings WHERE id = ?")
    .bind(listingId)
    .first<RawListing>();
  if (!listing) throw new MarketError("Listing not found.", 404);
  return listing;
}

function verifyRevision(listing: RawListing, requested: number) {
  if (!Number.isSafeInteger(requested) || requested < 0) {
    throw new MarketError("A valid listing revision is required.");
  }
  if (requested !== listing.revision) {
    throw new MarketError(
      "This listing changed while you were viewing it. Refresh and try again.",
      409,
    );
  }
}

async function changed(statement: D1PreparedStatement) {
  const result = await statement.run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new MarketError(
      "This listing was updated by someone else. Refresh and try again.",
      409,
    );
  }
}

async function recordEvent(args: {
  listingId: string;
  actorId: string | null;
  action: "mine" | "steal" | "grab" | "bid" | "settle";
  amount: number | null;
  fromStatus: ListingStatus;
  toStatus: ListingStatus;
  revision: number;
  now: string;
}) {
  await database()
    .prepare(
      `INSERT INTO item_state_events
       (id, listing_id, actor_id, action, amount, from_status, to_status, revision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id("event"),
      args.listingId,
      args.actorId,
      args.action,
      args.amount,
      args.fromStatus,
      args.toStatus,
      args.revision,
      args.now,
    )
    .run();
}

async function upsertCart(
  userId: string,
  listingId: string,
  section: "secured" | "active" | "lost",
  status: CartStatus,
  now: string,
) {
  await database()
    .prepare(
      `INSERT INTO cart_entries
       (id, user_id, listing_id, section, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, listing_id) DO UPDATE SET
         section = excluded.section,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .bind(id("cart"), userId, listingId, section, status, now, now)
    .run();
}

async function notify(args: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  listingId?: string | null;
  conversationId?: string | null;
  now: string;
}) {
  await database()
    .prepare(
      `INSERT INTO notifications
       (id, user_id, kind, title, body, listing_id, conversation_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      id("notification"),
      args.userId,
      args.kind,
      args.title,
      args.body,
      args.listingId ?? null,
      args.conversationId ?? null,
      args.now,
    )
    .run();
}

async function engagedUsers(listingId: string) {
  const rows = await database()
    .prepare(
      "SELECT DISTINCT actor_id FROM item_state_events WHERE listing_id = ? AND actor_id IS NOT NULL",
    )
    .bind(listingId)
    .all<{ actor_id: string }>();
  return rows.results.map((row) => row.actor_id);
}

function conversationId(listingId: string, first: string, second: string) {
  return `conversation-${listingId}-${[first, second].sort().join("-")}`;
}

async function finalizeSale(args: {
  listing: RawListing;
  buyerId: string;
  amount: number;
  source: "grab" | "mine" | "steal" | "bid";
  now: string;
}) {
  const db = database();
  const [item, buyer, seller, existingThread] = await Promise.all([
    db
      .prepare("SELECT title, description FROM items WHERE id = ?")
      .bind(args.listing.item_id)
      .first<{ title: string; description: string }>(),
    db
      .prepare("SELECT display_name, phone, email FROM users WHERE id = ?")
      .bind(args.buyerId)
      .first<{ display_name: string; phone: string; email: string }>(),
    db
      .prepare("SELECT display_name FROM users WHERE id = ?")
      .bind(args.listing.seller_id)
      .first<{ display_name: string }>(),
    db
      .prepare(
        `SELECT c.id FROM conversations c
         WHERE c.listing_id = ?
           AND EXISTS (
             SELECT 1 FROM conversation_members m
             WHERE m.conversation_id = c.id AND m.user_id = ?
           )
           AND EXISTS (
             SELECT 1 FROM conversation_members m
             WHERE m.conversation_id = c.id AND m.user_id = ?
           )
         ORDER BY c.updated_at DESC
         LIMIT 1`,
      )
      .bind(args.listing.id, args.buyerId, args.listing.seller_id)
      .first<{ id: string }>(),
  ]);
  if (!item || !buyer || !seller) {
    throw new MarketError("Sale participants or item details are missing.", 500);
  }

  const threadId =
    existingThread?.id ||
    conversationId(args.listing.id, args.buyerId, args.listing.seller_id);
  const sourceLabel = args.source === "grab" ? "Grabbed" : "Won";
  const systemBody = `${item.title} is secured for ₱${args.amount.toLocaleString("en-PH")}. Buyer: ${buyer.display_name} (${buyer.phone || buyer.email}). ${item.description} Use this chat to agree on payment, pickup or tracked delivery. Confirm the final arrangement here and use Report if either party needs help.`;
  const participants = new Set(await engagedUsers(args.listing.id));
  participants.delete(args.buyerId);
  participants.delete(args.listing.seller_id);

  const cartStatement = (
    userId: string,
    section: "secured" | "active" | "lost",
    status: CartStatus,
  ) =>
    db
      .prepare(
        `INSERT INTO cart_entries
         (id, user_id, listing_id, section, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, listing_id) DO UPDATE SET
           section = excluded.section,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        id("cart"),
        userId,
        args.listing.id,
        section,
        status,
        args.now,
        args.now,
      );
  const notificationStatement = (notice: {
    key: string;
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    conversationId?: string | null;
  }) =>
    db
      .prepare(
        `INSERT INTO notifications
         (id, user_id, kind, title, body, listing_id, conversation_id, read, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM notifications
           WHERE user_id = ? AND kind = ? AND listing_id = ?
         )`,
      )
      .bind(
        `notification-${notice.key}-${args.listing.id}`,
        notice.userId,
        notice.kind,
        notice.title,
        notice.body,
        args.listing.id,
        notice.conversationId ?? null,
        args.now,
        notice.userId,
        notice.kind,
        args.listing.id,
      );
  const eventAction = args.source === "grab" ? "grab" : "settle";
  const fromStatus: ListingStatus =
    args.source === "steal"
      ? "stolen"
      : args.source === "mine"
        ? "mined"
        : "available";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO item_state_events
         (id, listing_id, actor_id, action, amount, from_status, to_status, revision, created_at)
         SELECT ?, ?, ?, ?, ?, ?, 'sold', ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM item_state_events WHERE listing_id = ? AND revision = ?
         )`,
      )
      .bind(
        `event-sale-${args.listing.id}-${args.listing.revision + 1}`,
        args.listing.id,
        args.buyerId,
        eventAction,
        args.amount,
        fromStatus,
        args.listing.revision + 1,
        args.now,
        args.listing.id,
        args.listing.revision + 1,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO transactions
         (id, listing_id, buyer_id, seller_id, amount, source, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'secured', ?)`,
      )
      .bind(
        `transaction-${args.listing.id}`,
        args.listing.id,
        args.buyerId,
        args.listing.seller_id,
        args.amount,
        args.source,
        args.now,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO conversations (id, listing_id, updated_at) VALUES (?, ?, ?)",
      )
      .bind(threadId, args.listing.id, args.now),
    db
      .prepare(
        "INSERT OR IGNORE INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)\n",
      )
      .bind(`member-${threadId}-${args.buyerId}`, threadId, args.buyerId),
    db
      .prepare(
        "INSERT OR IGNORE INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)\n",
      )
      .bind(`member-${threadId}-${args.listing.seller_id}`, threadId, args.listing.seller_id),
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, body, system, created_at)
         SELECT ?, ?, NULL, ?, 1, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM messages WHERE conversation_id = ? AND system = 1
         )`,
      )
      .bind(`message-sale-${args.listing.id}`, threadId, systemBody, args.now, threadId),
  ];
  for (const participantId of participants) {
    statements.push(cartStatement(participantId, "lost", "Lost"));
    statements.push(notificationStatement({
      key: `lost-${participantId}`,
      userId: participantId,
      kind: "system",
      title: "Battle ended",
      body: `${item.title} has been secured by another buyer.`,
    }));
  }
  statements.push(cartStatement(args.buyerId, "secured", sourceLabel));
  statements.push(notificationStatement({
    key: "buyer",
    userId: args.buyerId,
    kind: "won",
    title: "You secured the item!",
    body: `${item.title} is ready in your secured cart. Message ${seller.display_name} to arrange delivery.`,
    conversationId: threadId,
  }));
  statements.push(notificationStatement({
    key: "seller",
    userId: args.listing.seller_id,
    kind: "sold",
    title: "Your item sold",
    body: `${buyer.display_name} secured ${item.title} for ₱${args.amount.toLocaleString("en-PH")}.`,
    conversationId: threadId,
  }));
  await db.batch(statements);
}

async function repairFinalizedSales() {
  const result = await database()
    .prepare(
      `SELECT l.* FROM listings l
       WHERE l.status = 'sold'
         AND l.current_winner_id IS NOT NULL
         AND l.sold_price IS NOT NULL
         AND (
           NOT EXISTS (SELECT 1 FROM transactions t WHERE t.listing_id = l.id)
           OR NOT EXISTS (
             SELECT 1 FROM cart_entries c
             WHERE c.listing_id = l.id AND c.user_id = l.current_winner_id AND c.section = 'secured'
           )
           OR NOT EXISTS (SELECT 1 FROM conversations c WHERE c.listing_id = l.id)
           OR NOT EXISTS (
             SELECT 1 FROM notifications n
             WHERE n.listing_id = l.id AND n.user_id = l.current_winner_id AND n.kind = 'won'
           )
           OR NOT EXISTS (
             SELECT 1 FROM notifications n
             WHERE n.listing_id = l.id AND n.user_id = l.seller_id AND n.kind = 'sold'
           )
         )`,
    )
    .all<RawListing>();
  for (const listing of result.results) {
    const source =
      listing.mode === "bidding"
        ? "bid"
        : listing.sold_price === listing.grab_price
          ? "grab"
          : listing.sold_price === listing.steal_price
            ? "steal"
            : "mine";
    await finalizeSale({
      listing: { ...listing, revision: Math.max(0, listing.revision - 1) },
      buyerId: listing.current_winner_id!,
      amount: listing.sold_price!,
      source,
      now: listing.sold_at || listing.updated_at,
    });
  }
}

async function settleExpired(now: Date, onlyListingId?: string) {
  const db = database();
  const nowIso = now.toISOString();
  const clause = onlyListingId ? " AND id = ?" : "";
  const query = db.prepare(
    `SELECT * FROM listings
     WHERE expires_at IS NOT NULL
       AND expires_at <= ?
       AND status IN ('available', 'mined', 'stolen')${clause}`,
  );
  const result = onlyListingId
    ? await query.bind(nowIso, onlyListingId).all<RawListing>()
    : await query.bind(nowIso).all<RawListing>();
  let settled = 0;

  for (const listing of result.results) {
    const amount =
      listing.mode === "bidding"
        ? listing.current_bid
        : listing.status === "stolen"
          ? listing.steal_price
          : listing.mine_price;
    const hasWinner = Boolean(listing.current_winner_id && amount !== null);
    const nextStatus: ListingStatus = hasWinner ? "sold" : "expired";
    const update = await db
      .prepare(
        `UPDATE listings SET
           status = ?,
           sold_at = ?,
           sold_price = ?,
           expires_at = NULL,
           revision = revision + 1,
           updated_at = ?
         WHERE id = ? AND revision = ? AND status = ?`,
      )
      .bind(
        nextStatus,
        hasWinner ? nowIso : null,
        hasWinner ? amount : null,
        nowIso,
        listing.id,
        listing.revision,
        listing.status,
      )
      .run();
    if ((update.meta.changes ?? 0) !== 1) continue;

    settled += 1;
    await recordEvent({
      listingId: listing.id,
      actorId: listing.current_winner_id,
      action: "settle",
      amount: hasWinner ? amount : null,
      fromStatus: listing.status,
      toStatus: nextStatus,
      revision: listing.revision + 1,
      now: nowIso,
    });
    if (hasWinner && listing.current_winner_id && amount !== null) {
      await finalizeSale({
        listing,
        buyerId: listing.current_winner_id,
        amount,
        source:
          listing.mode === "bidding"
            ? "bid"
            : listing.status === "stolen"
              ? "steal"
              : "mine",
        now: nowIso,
      });
    }
  }
  return settled;
}

async function mine(
  listing: RawListing,
  actorId: string,
  now: Date,
) {
  if (listing.mode !== "msg" || listing.status !== "available") {
    throw new MarketError("Only an available MSG listing can be mined.", 409);
  }
  if (listing.seller_id === actorId) {
    throw new MarketError("You cannot mine your own listing.");
  }
  if (listing.mine_price === null) throw new MarketError("Mine price is missing.", 500);
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + DAY_MS).toISOString();
  await changed(
    database()
      .prepare(
        `UPDATE listings SET
           status = 'mined', current_holder_id = ?, current_winner_id = ?,
           expires_at = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ? AND status = 'available'`,
      )
      .bind(actorId, actorId, expiresAt, nowIso, listing.id, listing.revision),
  );
  await recordEvent({
    listingId: listing.id,
    actorId,
    action: "mine",
    amount: listing.mine_price,
    fromStatus: "available",
    toStatus: "mined",
    revision: listing.revision + 1,
    now: nowIso,
  });
  await upsertCart(actorId, listing.id, "active", "Mined", nowIso);
  await notify({
    userId: listing.seller_id,
    kind: "mine",
    title: "Your item was mined",
    body: "A buyer started the 24-hour Mine timer.",
    listingId: listing.id,
    now: nowIso,
  });
  return "Mine secured. The 24-hour server timer is running.";
}

async function steal(
  listing: RawListing,
  actorId: string,
  now: Date,
) {
  if (
    listing.mode !== "msg" ||
    (listing.status !== "mined" && listing.status !== "stolen")
  ) {
    throw new MarketError("Only an active Mine or Steal can be stolen.", 409);
  }
  if (listing.seller_id === actorId) {
    throw new MarketError("You cannot steal your own listing.");
  }
  if (listing.current_holder_id === actorId) {
    throw new MarketError("You already hold the winning spot.");
  }
  if (listing.steal_price === null) throw new MarketError("Steal price is missing.", 500);
  const priorHolder = listing.current_holder_id;
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + STEAL_MS).toISOString();
  await changed(
    database()
      .prepare(
        `UPDATE listings SET
           status = 'stolen', current_holder_id = ?, current_winner_id = ?,
           expires_at = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ? AND status IN ('mined', 'stolen')`,
      )
      .bind(actorId, actorId, expiresAt, nowIso, listing.id, listing.revision),
  );
  const watchers = new Set(await engagedUsers(listing.id));
  watchers.add(listing.seller_id);
  if (priorHolder) watchers.add(priorHolder);
  watchers.delete(actorId);
  const actor = await requireUser(actorId);
  await recordEvent({
    listingId: listing.id,
    actorId,
    action: "steal",
    amount: listing.steal_price,
    fromStatus: listing.status,
    toStatus: "stolen",
    revision: listing.revision + 1,
    now: nowIso,
  });
  if (priorHolder) {
    await upsertCart(priorHolder, listing.id, "lost", "Lost", nowIso);
  }
  await upsertCart(actorId, listing.id, "active", "Stolen", nowIso);
  for (const userId of watchers) {
    await notify({
      userId,
      kind: "steal",
      title: `${actor.display_name} stole the spot`,
      body: "The winning position moved and a new 10-minute timer is running.",
      listingId: listing.id,
      now: nowIso,
    });
  }
  return "Steal successful. The server timer reset to 10 minutes.";
}

async function grab(
  listing: RawListing,
  actorId: string,
  now: Date,
) {
  if (
    listing.mode !== "msg" ||
    !["available", "mined", "stolen"].includes(listing.status)
  ) {
    throw new MarketError("This item can no longer be grabbed.", 409);
  }
  if (listing.seller_id === actorId) {
    throw new MarketError("You cannot grab your own listing.");
  }
  if (listing.grab_price === null) throw new MarketError("Grab price is missing.", 500);
  const nowIso = now.toISOString();
  await changed(
    database()
      .prepare(
        `UPDATE listings SET
           status = 'sold', current_holder_id = ?, current_winner_id = ?,
           expires_at = NULL, sold_at = ?, sold_price = ?,
           revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ? AND status IN ('available', 'mined', 'stolen')`,
      )
      .bind(
        actorId,
        actorId,
        nowIso,
        listing.grab_price,
        nowIso,
        listing.id,
        listing.revision,
      ),
  );
  await recordEvent({
    listingId: listing.id,
    actorId,
    action: "grab",
    amount: listing.grab_price,
    fromStatus: listing.status,
    toStatus: "sold",
    revision: listing.revision + 1,
    now: nowIso,
  });
  await finalizeSale({
    listing,
    buyerId: actorId,
    amount: listing.grab_price,
    source: "grab",
    now: nowIso,
  });
  return "Grab complete. The item is sold and locked in your secured cart.";
}

async function bid(
  listing: RawListing,
  actorId: string,
  amountValue: unknown,
  now: Date,
) {
  if (listing.mode !== "bidding" || listing.status !== "available") {
    throw new MarketError("This auction is no longer accepting bids.", 409);
  }
  if (listing.seller_id === actorId) {
    throw new MarketError("You cannot bid on your own listing.");
  }
  if (listing.current_holder_id === actorId) {
    throw new MarketError("You already have the highest bid.");
  }
  if (!listing.expires_at || listing.expires_at <= now.toISOString()) {
    throw new MarketError("This auction has expired.", 409);
  }
  if (listing.starting_bid === null || listing.bid_increment === null) {
    throw new MarketError("Auction pricing is incomplete.", 500);
  }
  const amount = asMoney(amountValue, "Bid");
  const minimum =
    listing.current_bid === null
      ? listing.starting_bid + listing.bid_increment
      : listing.current_bid + listing.bid_increment;
  if (amount < minimum) {
    throw new MarketError(
      `The next valid bid is at least ₱${minimum.toLocaleString("en-PH")}.`,
    );
  }
  const previousBidder = listing.current_holder_id;
  const nowIso = now.toISOString();
  await changed(
    database()
      .prepare(
        `UPDATE listings SET
           current_bid = ?, current_holder_id = ?, current_winner_id = ?,
           revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ? AND status = 'available' AND expires_at > ?`,
      )
      .bind(
        amount,
        actorId,
        actorId,
        nowIso,
        listing.id,
        listing.revision,
        nowIso,
      ),
  );
  await database()
    .prepare(
      "INSERT INTO bids (id, listing_id, bidder_id, amount, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id("bid"), listing.id, actorId, amount, nowIso)
    .run();
  await recordEvent({
    listingId: listing.id,
    actorId,
    action: "bid",
    amount,
    fromStatus: "available",
    toStatus: "available",
    revision: listing.revision + 1,
    now: nowIso,
  });
  await upsertCart(actorId, listing.id, "active", "Bidded", nowIso);
  if (previousBidder) {
    await upsertCart(previousBidder, listing.id, "lost", "Lost", nowIso);
    await notify({
      userId: previousBidder,
      kind: "outbid",
      title: "You were outbid",
      body: `The new high bid is ₱${amount.toLocaleString("en-PH")}.`,
      listingId: listing.id,
      now: nowIso,
    });
  }
  return `Bid accepted at ₱${amount.toLocaleString("en-PH")}.`;
}

async function sendMessage(
  request: Extract<MarketActionRequest, { action: "sendMessage" }>,
  actorId: string,
  now: Date,
) {
  const db = database();
  const body = requiredText(request.body, "Message", 2000);
  const nowIso = now.toISOString();
  let threadId = request.conversationId;

  if (threadId) {
    const membership = await db
      .prepare(
        "SELECT 1 AS allowed FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
      )
      .bind(threadId, actorId)
      .first<{ allowed: number }>();
    if (!membership) throw new MarketError("Conversation not found.", 404);
  } else {
    const recipientId = requiredText(request.recipientId, "Recipient", 100);
    await requireUser(recipientId);
    if (recipientId === actorId) throw new MarketError("Choose another user to message.");
    if (request.listingId) await requireListing(request.listingId);
    threadId = conversationId(request.listingId ?? "general", actorId, recipientId);
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO conversations (id, listing_id, updated_at) VALUES (?, ?, ?)",
        )
        .bind(threadId, request.listingId ?? null, nowIso),
      db
        .prepare(
          "INSERT OR IGNORE INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)",
        )
        .bind(id("member"), threadId, actorId),
      db
        .prepare(
          "INSERT OR IGNORE INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)",
        )
        .bind(id("member"), threadId, recipientId),
    ]);
  }

  await db.batch([
    db
      .prepare(
        "INSERT INTO messages (id, conversation_id, sender_id, body, system, created_at) VALUES (?, ?, ?, ?, 0, ?)",
      )
      .bind(id("message"), threadId, actorId, body, nowIso),
    db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .bind(nowIso, threadId),
  ]);
  const recipients = await db
    .prepare(
      "SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id <> ?",
    )
    .bind(threadId, actorId)
    .all<{ user_id: string }>();
  const sender = await requireUser(actorId);
  for (const recipient of recipients.results) {
    await notify({
      userId: recipient.user_id,
      kind: "message",
      title: `New message from ${sender.display_name}`,
      body: body.length > 88 ? `${body.slice(0, 85)}...` : body,
      conversationId: threadId,
      listingId: request.listingId ?? null,
      now: nowIso,
    });
  }
  return "Message sent.";
}

async function createUser(
  request: Extract<MarketActionRequest, { action: "createUser" }>,
  now: Date,
) {
  const username = requiredText(request.username, "Username", 40).toLowerCase();
  const displayName = requiredText(request.displayName, "Display name", 80);
  const email = requiredText(request.email, "Email", 160).toLowerCase();
  const phone = requiredText(request.phone, "Phone number", 40);
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new MarketError(
      "Use 3-40 letters, numbers, dots, dashes, or underscores for the username.",
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new MarketError("Enter a valid email address.");
  }
  const existing = await database()
    .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
    .bind(username, email)
    .first<{ id: string }>();
  if (existing) {
    throw new MarketError("That username or email is already registered.", 409);
  }

  const userId = id("user");
  await database()
    .prepare(
      "INSERT INTO users (id, username, display_name, email, phone, avatar_url, bio, location, preferred_shops_json, verified, joined_at) VALUES (?, ?, ?, ?, ?, NULL, '', '', '[]', 0, ?)",
    )
    .bind(userId, username, displayName, email, phone, now.toISOString())
    .run();
  return {
    userId,
    notice: "Welcome to OK-OK, " + displayName.split(" ")[0] + ".",
  };
}

async function updateProfile(
  request: Extract<MarketActionRequest, { action: "updateProfile" }>,
  actorId: string,
) {
  const displayName = requiredText(request.displayName, "Display name", 80);
  const phone =
    typeof request.phone === "string" ? request.phone.trim().slice(0, 40) : "";
  const bio =
    typeof request.bio === "string" ? request.bio.trim().slice(0, 320) : "";
  const location =
    typeof request.location === "string"
      ? request.location.trim().slice(0, 120)
      : "";
  const topSize =
    typeof request.preferredTopSize === "string"
      ? request.preferredTopSize.trim().slice(0, 24)
      : "";
  const bottomSize =
    typeof request.preferredBottomSize === "string"
      ? request.preferredBottomSize.trim().slice(0, 24)
      : "";
  const shoeSize =
    typeof request.preferredShoeSize === "string"
      ? request.preferredShoeSize.trim().slice(0, 24)
      : "";
  const styleTags = Array.isArray(request.styleTags)
    ? request.styleTags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  await database()
    .prepare(
      "UPDATE users SET display_name = ?, phone = ?, bio = ?, location = ?, preferred_top_size = ?, preferred_bottom_size = ?, preferred_shoe_size = ?, style_tags_json = ? WHERE id = ?",
    )
    .bind(
      displayName,
      phone,
      bio,
      location,
      topSize,
      bottomSize,
      shoeSize,
      JSON.stringify(styleTags),
      actorId,
    )
    .run();
  return "Profile settings saved.";
}

async function createListing(
  request: Extract<MarketActionRequest, { action: "createListing" }>,
  actorId: string,
  now: Date,
) {
  const title = requiredText(request.title, "Item title", 120);
  const description = requiredText(request.description, "Description", 1600);
  if (!MARKET_CATEGORIES.includes(request.category as MarketCategory)) {
    throw new MarketError("Choose a valid category.");
  }
  if (request.mode !== "msg" && request.mode !== "bidding") {
    throw new MarketError("Choose MSG or Bidding as the selling mode.");
  }
  const itemId = id("item");
  const listingId = id("listing");
  const nowIso = now.toISOString();
  let minePrice: number | null = null;
  let stealPrice: number | null = null;
  let grabPrice: number | null = null;
  let startingBid: number | null = null;
  let bidIncrement: number | null = null;
  let expiresAt: string | null = null;

  if (request.mode === "msg") {
    minePrice = asMoney(request.minePrice, "Mine price");
    stealPrice = asMoney(request.stealPrice, "Steal price");
    grabPrice = asMoney(request.grabPrice, "Grab price");
    if (!(minePrice < stealPrice && stealPrice < grabPrice)) {
      throw new MarketError("MSG prices must increase from Mine to Steal to Grab.");
    }
  } else {
    startingBid = asMoney(request.startingBid, "Starting bid");
    bidIncrement = asMoney(request.bidIncrement, "Bid increment");
    const duration = Math.min(168, Math.max(1, Number(request.durationHours) || 24));
    expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();
  }

  const imageUrl =
    typeof request.imageUrl === "string" && request.imageUrl.trim()
      ? request.imageUrl.trim()
      : "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=85";
  const images = Array.from(
    new Set(
      [imageUrl, ...(Array.isArray(request.images) ? request.images : [])].filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      ),
    ),
  ).slice(0, 6);
  const db = database();
  await db.batch([
    db
      .prepare(
        `INSERT INTO items
         (id, seller_id, title, description, category, brand, condition, size, image_url, images_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        itemId,
        actorId,
        title,
        description,
        request.category,
        typeof request.brand === "string" && request.brand.trim()
          ? request.brand.trim()
          : "Unbranded",
        typeof request.condition === "string" && request.condition.trim()
          ? request.condition.trim()
          : "Pre-loved",
        typeof request.size === "string" && request.size.trim()
          ? request.size.trim()
          : "One size",
        imageUrl,
        JSON.stringify(images),
        nowIso,
      ),
    db
      .prepare(
        `INSERT INTO listings
         (id, item_id, seller_id, mode, status, mine_price, steal_price, grab_price,
          starting_bid, bid_increment, expires_at, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(
        listingId,
        itemId,
        actorId,
        request.mode,
        minePrice,
        stealPrice,
        grabPrice,
        startingBid,
        bidIncrement,
        expiresAt,
        nowIso,
        nowIso,
      ),
  ]);
  return `${title} is live.`;
}

async function createReport(
  request: Extract<MarketActionRequest, { action: "report" }>,
  actorId: string,
  now: Date,
) {
  const listing = await requireListing(request.listingId);
  const reason = requiredText(request.reason, "Report reason", 120);
  const details =
    typeof request.details === "string" ? request.details.trim().slice(0, 1600) : "";
  const nowIso = now.toISOString();
  await database()
    .prepare(
      `INSERT INTO reports
       (id, reporter_id, listing_id, reason, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    )
    .bind(id("report"), actorId, listing.id, reason, details, nowIso)
    .run();
  if (listing.seller_id !== actorId) {
    await notify({
      userId: listing.seller_id,
      kind: "report",
      title: "A listing concern was submitted",
      body: "The OK-OK team will review the report and may contact both parties.",
      listingId: listing.id,
      now: nowIso,
    });
  }
  return "Report submitted for review.";
}

async function loadMarketState(
  viewerId: string | null = DEMO_VIEWER_ID,
): Promise<MarketState> {
  const db = getDb();
  const [
    userRows,
    itemRows,
    listingRows,
    eventRows,
    bidRows,
    notificationRows,
    conversationRows,
    memberRows,
    messageRows,
    cartRows,
    reportRows,
    transactionRows,
  ] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.items).orderBy(desc(schema.items.createdAt)),
    db.select().from(schema.listings).orderBy(desc(schema.listings.updatedAt)),
    db.select().from(schema.itemStateEvents).orderBy(desc(schema.itemStateEvents.createdAt)),
    db.select().from(schema.bids).orderBy(desc(schema.bids.amount)),
    db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt)),
    db.select().from(schema.conversations).orderBy(desc(schema.conversations.updatedAt)),
    db.select().from(schema.conversationMembers),
    db.select().from(schema.messages).orderBy(schema.messages.createdAt),
    db.select().from(schema.cartEntries).orderBy(desc(schema.cartEntries.updatedAt)),
    db.select().from(schema.reports).orderBy(desc(schema.reports.createdAt)),
    db.select().from(schema.transactions).orderBy(desc(schema.transactions.createdAt)),
  ]);
  const membersByConversation = new Map<string, string[]>();
  for (const member of memberRows) {
    const members = membersByConversation.get(member.conversationId) ?? [];
    members.push(member.userId);
    membersByConversation.set(member.conversationId, members);
  }
  const viewerConversationIds = new Set(
    memberRows
      .filter((member) => member.userId === viewerId)
      .map((member) => member.conversationId),
  );
  const activeListings = listingRows.filter(
    (listing) => listing.status !== "expired" && listing.status !== "sold",
  );
  const featured = activeListings.toSorted((a, b) => {
    const bPrice = b.currentBid ?? b.startingBid ?? b.minePrice ?? 0;
    const aPrice = a.currentBid ?? a.startingBid ?? a.minePrice ?? 0;
    return bPrice - aPrice;
  })[0];

  return {
    viewerId: viewerId ?? "",
    categories: [...MARKET_CATEGORIES],
    featuredListingId: featured?.id ?? null,
    users: userRows.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.id === viewerId ? user.email : "",
      phone: user.id === viewerId ? user.phone : "",
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      preferredShops:
        user.id === viewerId ? parseJsonList(user.preferredShopsJson) : [],
      preferredTopSize: user.id === viewerId ? user.preferredTopSize : "",
      preferredBottomSize:
        user.id === viewerId ? user.preferredBottomSize : "",
      preferredShoeSize: user.id === viewerId ? user.preferredShoeSize : "",
      styleTags: user.id === viewerId ? parseJsonList(user.styleTagsJson) : [],
      verified: user.verified,
      joinedAt: user.joinedAt,
    })),
    items: itemRows.map((item) => ({
      id: item.id,
      sellerId: item.sellerId,
      title: item.title,
      description: item.description,
      category: item.category as MarketCategory,
      brand: item.brand,
      condition: item.condition,
      size: item.size,
      imageUrl: item.imageUrl,
      images: parseJsonList(item.imagesJson),
      createdAt: item.createdAt,
    })),
    listings: listingRows.map((listing) => ({
      ...listing,
      mode: listing.mode as "msg" | "bidding",
      status: listing.status as ListingStatus,
    })),
    events: eventRows.map((event) => ({
      ...event,
      action: event.action as "mine" | "steal" | "grab" | "bid" | "settle",
      fromStatus: event.fromStatus as ListingStatus,
      toStatus: event.toStatus as ListingStatus,
    })),
    bids: bidRows,
    notifications: notificationRows
      .filter((notification) => notification.userId === viewerId)
      .map((notification) => ({
        ...notification,
        kind: notification.kind as NotificationKind,
      })),
    conversations: conversationRows
      .filter((conversation) => viewerConversationIds.has(conversation.id))
      .map((conversation) => ({
        id: conversation.id,
        participantIds: membersByConversation.get(conversation.id) ?? [],
        listingId: conversation.listingId,
        updatedAt: conversation.updatedAt,
      })),
    messages: messageRows.filter((message) =>
      viewerConversationIds.has(message.conversationId),
    ),
    cartEntries: cartRows
      .filter((entry) => entry.userId === viewerId)
      .map((entry) => ({
        ...entry,
        section: entry.section as "secured" | "active" | "lost",
        status: entry.status as CartStatus,
      })),
    reports: reportRows
      .filter((report) => report.reporterId === viewerId)
      .map((report) => ({
        ...report,
        status: report.status as "open" | "reviewing" | "resolved",
      })),
    transactions: transactionRows
      .filter(
        (transaction) =>
          transaction.buyerId === viewerId || transaction.sellerId === viewerId,
      )
      .map((transaction) => ({
        ...transaction,
        source: transaction.source as "grab" | "mine" | "steal" | "bid",
        status: transaction.status as "secured" | "completed" | "cancelled",
      })),
  };
}

export async function getMarketResponse(
  notice?: string,
  viewerId: string | null = DEMO_VIEWER_ID,
): Promise<MarketApiResponse> {
  await ensureMarketReady();
  const now = new Date();
  await settleExpired(now);
  await repairFinalizedSales();
  return {
    state: await loadMarketState(viewerId),
    serverNow: now.toISOString(),
    ...(notice ? { notice } : {}),
  };
}

export async function runMarketAction(
  request: MarketActionRequest,
  actorOverride?: string,
): Promise<MarketApiResponse> {
  await ensureMarketReady();
  if (!request || typeof request !== "object" || typeof request.action !== "string") {
    throw new MarketError("A market action is required.");
  }
  const now = new Date();
  if (request.action === "createUser") {
    const created = await createUser(request, now);
    return getMarketResponse(created.notice, created.userId);
  }
  // A dedicated settle request reports its own count. Every other mutation
  // first resolves deadlines so an action can never race a server expiry.
  if (request.action !== "settle") await settleExpired(now);
  const actorId =
    actorOverride ||
    (typeof request.actorId === "string" && request.actorId.trim()
      ? request.actorId.trim()
      : DEMO_VIEWER_ID);
  await requireUser(actorId);
  let notice: string;

  switch (request.action) {
    case "mine":
    case "steal":
    case "grab": {
      const listing = await requireListing(request.listingId);
      verifyRevision(listing, request.revision);
      if (request.action === "mine") notice = await mine(listing, actorId, now);
      else if (request.action === "steal") notice = await steal(listing, actorId, now);
      else notice = await grab(listing, actorId, now);
      break;
    }
    case "bid": {
      const listing = await requireListing(request.listingId);
      verifyRevision(listing, request.revision);
      notice = await bid(listing, actorId, request.amount, now);
      break;
    }
    case "settle": {
      if (request.listingId) await requireListing(request.listingId);
      const count = await settleExpired(now, request.listingId);
      notice = count
        ? `${count} expired listing${count === 1 ? "" : "s"} settled.`
        : "No expired listings needed settlement.";
      break;
    }
    case "sendMessage":
      notice = await sendMessage(request, actorId, now);
      break;
    case "updateProfile":
      notice = await updateProfile(request, actorId);
      break;
    case "createListing":
      notice = await createListing(request, actorId, now);
      break;
    case "report":
      notice = await createReport(request, actorId, now);
      break;
    default:
      throw new MarketError("Unsupported market action.");
  }
  return getMarketResponse(notice, actorId);
}

export function marketErrorStatus(error: unknown) {
  return error instanceof MarketError ? error.status : 500;
}

export function marketErrorMessage(error: unknown) {
  if (error instanceof MarketError) return error.message;
  return error instanceof Error ? error.message : "Unexpected market error.";
}
