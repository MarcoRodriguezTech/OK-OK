export const MARKET_CATEGORIES = [
  "Caps",
  "Jackets",
  "Shirts",
  "Pants",
  "Shorts",
  "Shoes",
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export type ListingMode = "msg" | "bidding";
export type ListingStatus =
  | "available"
  | "mined"
  | "stolen"
  | "sold"
  | "expired";
export type MarketActionKind =
  | "mine"
  | "steal"
  | "grab"
  | "bid"
  | "settle";

export interface MarketUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  bio: string;
  location: string;
  preferredShops: string[];
  preferredTopSize: string;
  preferredBottomSize: string;
  preferredShoeSize: string;
  styleTags: string[];
  verified: boolean;
  joinedAt: string;
}

export interface MarketItem {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: MarketCategory;
  brand: string;
  condition: string;
  size: string;
  imageUrl: string;
  images: string[];
  createdAt: string;
}

export interface MarketListing {
  id: string;
  itemId: string;
  sellerId: string;
  mode: ListingMode;
  status: ListingStatus;
  minePrice: number | null;
  stealPrice: number | null;
  grabPrice: number | null;
  startingBid: number | null;
  bidIncrement: number | null;
  currentBid: number | null;
  currentHolderId: string | null;
  currentWinnerId: string | null;
  expiresAt: string | null;
  soldAt: string | null;
  soldPrice: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketEvent {
  id: string;
  listingId: string;
  actorId: string | null;
  action: MarketActionKind;
  amount: number | null;
  fromStatus: ListingStatus;
  toStatus: ListingStatus;
  revision: number;
  createdAt: string;
}

export interface MarketBid {
  id: string;
  listingId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

export type NotificationKind =
  | "mine"
  | "steal"
  | "bid"
  | "outbid"
  | "won"
  | "sold"
  | "message"
  | "report"
  | "system";

export interface MarketNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  listingId: string | null;
  conversationId: string | null;
  read: boolean;
  createdAt: string;
}

export interface MarketConversation {
  id: string;
  participantIds: string[];
  listingId: string | null;
  updatedAt: string;
}

export interface MarketMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  system: boolean;
  createdAt: string;
}

export type CartSection = "secured" | "active" | "lost";
export type CartStatus =
  | "Mined"
  | "Stolen"
  | "Grabbed"
  | "Bidded"
  | "Won"
  | "Lost";

export interface MarketCartEntry {
  id: string;
  userId: string;
  listingId: string;
  section: CartSection;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarketReport {
  id: string;
  reporterId: string;
  listingId: string;
  reason: string;
  details: string;
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
}

export interface MarketTransaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  source: "grab" | "mine" | "steal" | "bid";
  status: "secured" | "completed" | "cancelled";
  createdAt: string;
}

export interface MarketState {
  viewerId: string;
  categories: MarketCategory[];
  featuredListingId: string | null;
  users: MarketUser[];
  items: MarketItem[];
  listings: MarketListing[];
  events: MarketEvent[];
  bids: MarketBid[];
  notifications: MarketNotification[];
  conversations: MarketConversation[];
  messages: MarketMessage[];
  cartEntries: MarketCartEntry[];
  reports: MarketReport[];
  transactions: MarketTransaction[];
}

interface ListingActionBase {
  actorId?: string;
  listingId: string;
  /** Optimistic concurrency guard. The API rejects a stale revision. */
  revision: number;
}

export type MarketActionRequest =
  | (ListingActionBase & { action: "mine" | "steal" | "grab" })
  | (ListingActionBase & { action: "bid"; amount: number })
  | { action: "settle"; actorId?: string; listingId?: string }
  | {
      action: "createUser";
      username: string;
      displayName: string;
      email: string;
      phone: string;
    }
  | {
      action: "updateProfile";
      actorId?: string;
      displayName: string;
      phone: string;
      bio?: string;
      location?: string;
      preferredTopSize?: string;
      preferredBottomSize?: string;
      preferredShoeSize?: string;
      styleTags?: string[];
    }
  | {
      action: "sendMessage";
      actorId?: string;
      conversationId?: string;
      recipientId?: string;
      listingId?: string;
      body: string;
    }
  | {
      action: "createListing";
      actorId?: string;
      title: string;
      description: string;
      category: MarketCategory;
      brand?: string;
      condition?: string;
      size?: string;
      imageUrl?: string;
      images?: string[];
      mode: ListingMode;
      minePrice?: number;
      stealPrice?: number;
      grabPrice?: number;
      startingBid?: number;
      bidIncrement?: number;
      durationHours?: number;
    }
  | {
      action: "report";
      actorId?: string;
      listingId: string;
      reason: string;
      details?: string;
    };

export interface MarketApiResponse {
  state: MarketState | null;
  serverNow: string;
  notice?: string;
}
