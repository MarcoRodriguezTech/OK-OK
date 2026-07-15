"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ListingMode = "msg" | "bid";
type ListingStatus =
  | "available"
  | "mined"
  | "stolen"
  | "bidding"
  | "grabbed"
  | "sold"
  | "expired";

type User = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  avatar: string;
  shopName?: string;
  bio?: string;
  location?: string;
  preferredTopSize?: string;
  preferredBottomSize?: string;
  preferredShoeSize?: string;
  styleTags?: string[];
  joined: string;
};

type Item = {
  id: string;
  title: string;
  category: string;
  description: string;
  condition: string;
  size: string;
  color: string;
  sellerId: string;
  images: string[];
  tags: string[];
};

type Listing = {
  id: string;
  itemId: string;
  mode: ListingMode;
  status: ListingStatus;
  minePrice?: number;
  stealPrice?: number;
  grabPrice?: number;
  startingBid?: number;
  bidIncrement?: number;
  currentBid?: number;
  currentBidderId?: string;
  holderId?: string;
  expiresAt?: number;
  engagedUserIds: string[];
  soldPrice?: number;
  cartSections?: Record<string, "secured" | "active" | "lost">;
  revision: number;
};

type Notice = {
  id: string;
  userId: string;
  title: string;
  body: string;
  itemId?: string;
  conversationId?: string;
  createdAt: number;
  read: boolean;
  tone: "success" | "warning" | "info";
};

type Message = {
  id: string;
  senderId: string;
  body: string;
  createdAt: number;
  system?: boolean;
};

type Conversation = {
  id: string;
  userIds: string[];
  itemId?: string;
  messages: Message[];
};

type MarketState = {
  users: User[];
  items: Item[];
  listings: Listing[];
  notifications: Notice[];
  conversations: Conversation[];
  serverNow: number;
};

type CanonicalMarketState = {
  viewerId?: string;
  users?: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
    bio?: string;
    location?: string;
    preferredTopSize?: string;
    preferredBottomSize?: string;
    preferredShoeSize?: string;
    styleTags?: string[];
    joinedAt: string;
  }>;
  items?: Array<{
    id: string;
    sellerId: string;
    title: string;
    description: string;
    category: string;
    brand?: string;
    condition: string;
    size: string;
    imageUrl: string;
    images?: string[];
  }>;
  listings?: Array<{
    id: string;
    itemId: string;
    mode: "msg" | "bidding";
    status: "available" | "mined" | "stolen" | "sold" | "expired";
    minePrice: number | null;
    stealPrice: number | null;
    grabPrice: number | null;
    startingBid: number | null;
    bidIncrement: number | null;
    currentBid: number | null;
    currentHolderId: string | null;
    currentWinnerId: string | null;
    expiresAt: string | null;
    soldPrice?: number | null;
    revision: number;
  }>;
  events?: Array<{ listingId: string; actorId: string | null }>;
  bids?: Array<{ listingId: string; bidderId: string }>;
  notifications?: Array<{
    id: string;
    userId: string;
    kind: string;
    title: string;
    body: string;
    listingId: string | null;
    conversationId?: string | null;
    read: boolean;
    createdAt: string;
  }>;
  conversations?: Array<{ id: string; participantIds: string[]; listingId: string | null }>;
  messages?: Array<{
    id: string;
    conversationId: string;
    senderId: string | null;
    body: string;
    system: boolean;
    createdAt: string;
  }>;
  cartEntries?: Array<{
    userId: string;
    listingId: string;
    section: "secured" | "active" | "lost";
    status: string;
  }>;
};

const IMG = {
  jacket:
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=88",
  jacketDetail:
    "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=88",
  cap:
    "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1200&q=88",
  denim:
    "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=88",
  shoes:
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=88",
  polo:
    "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&w=1200&q=88",
  windbreaker:
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=88",
  cargos:
    "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=1200&q=88",
  runners:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=88",
  avatar1:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=85",
  avatar2:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=85",
  avatar3:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=85",
};

const now = Date.now();

const initialState: MarketState = {
  serverNow: now,
  users: [
    {
      id: "u-mia",
      username: "miasantos",
      displayName: "Mia Santos",
      email: "mia@ok-ok.demo",
      phone: "0917 555 0188",
      avatar: IMG.avatar1,
      joined: "January 2025",
    },
    {
      id: "u-jhon",
      username: "jhonmarco",
      displayName: "Jhon Marco",
      email: "jhon@ok-ok.demo",
      phone: "0918 444 3201",
      avatar: IMG.avatar2,
      shopName: "Marco Finds",
      joined: "August 2024",
    },
    {
      id: "u-aya",
      username: "ayagarments",
      displayName: "Aya Reyes",
      email: "aya@ok-ok.demo",
      phone: "0920 113 8821",
      avatar: IMG.avatar3,
      shopName: "Sunday Rack",
      joined: "May 2024",
    },
  ],
  items: [
    {
      id: "leather-rally-jacket",
      title: "Leather Rally Jacket",
      category: "Jacket",
      description:
        "A lived-in chocolate leather jacket with a clean cropped fit, satin lining, and just the right amount of patina.",
      condition: "Very good",
      size: "M",
      color: "Chocolate",
      sellerId: "u-jhon",
      images: [IMG.jacket, IMG.jacketDetail, IMG.cargos],
      tags: ["one of one", "unisex", "fits true"],
    },
    {
      id: "embroidered-cap",
      title: "Embroidered Varsity Cap",
      category: "Cap",
      description: "Soft washed cotton cap with hand-stitched varsity lettering and an adjustable brass clasp.",
      condition: "Excellent",
      size: "Adjustable",
      color: "Forest",
      sellerId: "u-aya",
      images: [IMG.cap],
      tags: ["washed", "embroidered"],
    },
    {
      id: "y2k-denim",
      title: "Y2K Straight-Leg Denim",
      category: "Pants",
      description: "Mid-rise vintage denim with a relaxed straight leg and subtle whiskering.",
      condition: "Very good",
      size: "29",
      color: "Indigo",
      sellerId: "u-jhon",
      images: [IMG.denim],
      tags: ["vintage", "denim", "29 waist"],
    },
    {
      id: "penny-loafers",
      title: "Oxblood Penny Loafers",
      category: "Shoes",
      description: "Polished leather loafers with a stacked heel and cushioned insole.",
      condition: "Good",
      size: "EU 39",
      color: "Oxblood",
      sellerId: "u-aya",
      images: [IMG.shoes],
      tags: ["leather", "classic"],
    },
    {
      id: "crochet-polo",
      title: "Hand-Crochet Polo",
      category: "Shirts",
      description: "Breathable open-knit polo in a warm cream tone, handmade and slightly oversized.",
      condition: "Excellent",
      size: "L",
      color: "Cream",
      sellerId: "u-aya",
      images: [IMG.polo],
      tags: ["handmade", "oversized"],
    },
    {
      id: "nylon-windbreaker",
      title: "Two-Tone Nylon Shell",
      category: "Jacket",
      description: "Lightweight technical shell with storm flap, drawcord hem, and two zip pockets.",
      condition: "Excellent",
      size: "L",
      color: "Sage / Ink",
      sellerId: "u-jhon",
      images: [IMG.windbreaker],
      tags: ["gorpcore", "lightweight"],
    },
    {
      id: "utility-cargos",
      title: "Olive Utility Cargos",
      category: "Pants",
      description: "Relaxed utility trousers with articulated knees and six roomy pockets.",
      condition: "Very good",
      size: "32",
      color: "Olive",
      sellerId: "u-aya",
      images: [IMG.cargos],
      tags: ["utility", "six pocket"],
    },
    {
      id: "retro-runners",
      title: "Retro Mesh Runners",
      category: "Shoes",
      description: "Early-2000s inspired mesh runners with a springy sole and reflective panels.",
      condition: "Good",
      size: "EU 41",
      color: "Silver / Red",
      sellerId: "u-jhon",
      images: [IMG.runners],
      tags: ["y2k", "sport"],
    },
  ],
  listings: [
    {
      id: "l-jacket",
      itemId: "leather-rally-jacket",
      mode: "msg",
      status: "available",
      minePrice: 800,
      stealPrice: 1000,
      grabPrice: 1200,
      engagedUserIds: [],
      revision: 1,
    },
    {
      id: "l-cap",
      itemId: "embroidered-cap",
      mode: "msg",
      status: "mined",
      minePrice: 350,
      stealPrice: 475,
      grabPrice: 650,
      holderId: "u-mia",
      expiresAt: now + 2 * 60 * 60 * 1000 + 18 * 60 * 1000,
      engagedUserIds: ["u-mia"],
      revision: 2,
    },
    {
      id: "l-denim",
      itemId: "y2k-denim",
      mode: "msg",
      status: "stolen",
      minePrice: 650,
      stealPrice: 825,
      grabPrice: 1100,
      holderId: "u-aya",
      expiresAt: now + 7 * 60 * 1000 + 42 * 1000,
      engagedUserIds: ["u-mia", "u-aya"],
      revision: 4,
    },
    {
      id: "l-loafers",
      itemId: "penny-loafers",
      mode: "msg",
      status: "grabbed",
      minePrice: 900,
      stealPrice: 1150,
      grabPrice: 1450,
      holderId: "u-mia",
      engagedUserIds: ["u-mia"],
      revision: 3,
    },
    {
      id: "l-polo",
      itemId: "crochet-polo",
      mode: "bid",
      status: "bidding",
      startingBid: 500,
      bidIncrement: 50,
      currentBid: 850,
      currentBidderId: "u-mia",
      expiresAt: now + 4 * 60 * 60 * 1000 + 12 * 60 * 1000,
      engagedUserIds: ["u-mia", "u-aya"],
      revision: 6,
    },
    {
      id: "l-shell",
      itemId: "nylon-windbreaker",
      mode: "bid",
      status: "bidding",
      startingBid: 750,
      bidIncrement: 100,
      currentBid: 1200,
      currentBidderId: "u-aya",
      expiresAt: now + 59 * 60 * 1000,
      engagedUserIds: ["u-mia", "u-aya"],
      revision: 5,
    },
    {
      id: "l-cargos",
      itemId: "utility-cargos",
      mode: "msg",
      status: "available",
      minePrice: 550,
      stealPrice: 700,
      grabPrice: 900,
      engagedUserIds: [],
      revision: 1,
    },
    {
      id: "l-runners",
      itemId: "retro-runners",
      mode: "bid",
      status: "bidding",
      startingBid: 450,
      bidIncrement: 50,
      currentBid: 450,
      expiresAt: now + 18 * 60 * 60 * 1000,
      engagedUserIds: [],
      revision: 1,
    },
  ],
  notifications: [
    {
      id: "n1",
      userId: "u-mia",
      title: "Aya STOLE the denim",
      body: "Your spot was taken. Steal it back before the timer ends.",
      itemId: "y2k-denim",
      createdAt: now - 2 * 60 * 1000,
      read: false,
      tone: "warning",
    },
    {
      id: "n2",
      userId: "u-mia",
      title: "You lead the polo bid",
      body: "Your ₱850 bid is still on top.",
      itemId: "crochet-polo",
      createdAt: now - 42 * 60 * 1000,
      read: false,
      tone: "success",
    },
    {
      id: "n3",
      userId: "u-mia",
      title: "Loafers secured",
      body: "You grabbed them. Message Sunday Rack to arrange delivery.",
      itemId: "penny-loafers",
      createdAt: now - 5 * 60 * 60 * 1000,
      read: true,
      tone: "info",
    },
  ],
  conversations: [
    {
      id: "c-jhon",
      userIds: ["u-mia", "u-jhon"],
      itemId: "leather-rally-jacket",
      messages: [
        {
          id: "m1",
          senderId: "u-jhon",
          body: "Hey Mia! The jacket measures 21 inches pit to pit.",
          createdAt: now - 48 * 60 * 1000,
        },
        {
          id: "m2",
          senderId: "u-mia",
          body: "Perfect, thank you. Is the lining intact?",
          createdAt: now - 43 * 60 * 1000,
        },
        {
          id: "m3",
          senderId: "u-jhon",
          body: "Yes, no tears or repairs inside.",
          createdAt: now - 40 * 60 * 1000,
        },
      ],
    },
    {
      id: "c-aya",
      userIds: ["u-mia", "u-aya"],
      itemId: "penny-loafers",
      messages: [
        {
          id: "m4",
          senderId: "system",
          system: true,
          body:
            "ITEM SECURED — Oxblood Penny Loafers. Mia Santos won this item. Seller and buyer can now confirm payment and delivery here.",
          createdAt: now - 5 * 60 * 60 * 1000,
        },
        {
          id: "m5",
          senderId: "u-aya",
          body: "Congrats! I can ship tomorrow via J&T or arrange a Makati meetup.",
          createdAt: now - 4.8 * 60 * 60 * 1000,
        },
      ],
    },
  ],
};

const categories = ["All", "Cap", "Jacket", "Shirts", "Pants", "Shorts", "Shoes"];

function singularCategory(value: string) {
  if (value === "Caps") return "Cap";
  if (value === "Jackets") return "Jacket";
  return value;
}

function isHostedClient() {
  if (typeof window === "undefined") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function normalizeApiState(raw: unknown, serverNowRaw?: string | number): {
  state: MarketState;
  viewerId?: string;
} | null {
  const source = raw as CanonicalMarketState | null;
  if (!source?.users || !source.items || !source.listings) return null;
  const sellerIds = new Set(source.items.map((item) => item.sellerId));
  const avatarFallbacks = [IMG.avatar1, IMG.avatar2, IMG.avatar3];
  const users: User[] = source.users.map((user, index) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    avatar: user.avatarUrl || avatarFallbacks[index % avatarFallbacks.length],
    shopName: sellerIds.has(user.id) ? user.displayName.split(" ")[0] + "’s Rack" : undefined,
    bio: user.bio || "",
    location: user.location || "",
    preferredTopSize: user.preferredTopSize || "",
    preferredBottomSize: user.preferredBottomSize || "",
    preferredShoeSize: user.preferredShoeSize || "",
    styleTags: user.styleTags || [],
    joined: new Date(user.joinedAt).toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
  }));
  const items: Item[] = source.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: singularCategory(item.category),
    description: item.description,
    condition: item.condition,
    size: item.size,
    color: "Seller specified",
    sellerId: item.sellerId,
    images: item.images?.length ? item.images : [item.imageUrl],
    tags: [item.brand || "Pre-loved", item.condition.toLowerCase()],
  }));
  const engagedByListing = new Map<string, Set<string>>();
  const cartsByListing = new Map<string, Record<string, "secured" | "active" | "lost">>();
  const engage = (listingId: string, userId: string | null | undefined) => {
    if (!userId) return;
    const usersForListing = engagedByListing.get(listingId) || new Set<string>();
    usersForListing.add(userId);
    engagedByListing.set(listingId, usersForListing);
  };
  source.events?.forEach((event) => engage(event.listingId, event.actorId));
  source.bids?.forEach((bid) => engage(bid.listingId, bid.bidderId));
  source.cartEntries?.forEach((entry) => {
    engage(entry.listingId, entry.userId);
    const listingCarts = cartsByListing.get(entry.listingId) || {};
    listingCarts[entry.userId] = entry.section;
    cartsByListing.set(entry.listingId, listingCarts);
  });
  const listings: Listing[] = source.listings.map((listing) => {
    const bidding = listing.mode === "bidding";
    const status: ListingStatus =
      bidding && listing.status === "available"
        ? "bidding"
        : listing.status;
    return {
      id: listing.id,
      itemId: listing.itemId,
      mode: bidding ? "bid" : "msg",
      status,
      minePrice: listing.minePrice ?? undefined,
      stealPrice: listing.stealPrice ?? undefined,
      grabPrice: listing.grabPrice ?? undefined,
      startingBid: listing.startingBid ?? undefined,
      bidIncrement: listing.bidIncrement ?? undefined,
      currentBid: listing.currentBid ?? undefined,
      currentBidderId: bidding
        ? listing.currentHolderId || listing.currentWinnerId || undefined
        : undefined,
      holderId: bidding
        ? listing.currentWinnerId || undefined
        : listing.currentHolderId || listing.currentWinnerId || undefined,
      expiresAt: listing.expiresAt ? new Date(listing.expiresAt).getTime() : undefined,
      engagedUserIds: Array.from(engagedByListing.get(listing.id) || []),
      soldPrice: listing.soldPrice ?? undefined,
      cartSections: cartsByListing.get(listing.id),
      revision: listing.revision,
    };
  });
  const itemIdByListing = new Map(listings.map((listing) => [listing.id, listing.itemId]));
  const notifications: Notice[] = (source.notifications || []).map((notice) => ({
    id: notice.id,
    userId: notice.userId,
    title: notice.title,
    body: notice.body,
    itemId: notice.listingId ? itemIdByListing.get(notice.listingId) : undefined,
    conversationId: notice.conversationId || undefined,
    createdAt: new Date(notice.createdAt).getTime(),
    read: notice.read,
    tone: ["won", "sold"].includes(notice.kind)
      ? "success"
      : ["steal", "outbid"].includes(notice.kind)
        ? "warning"
        : "info",
  }));
  const messages = source.messages || [];
  const conversations: Conversation[] = (source.conversations || []).map((conversation) => ({
    id: conversation.id,
    userIds: conversation.participantIds,
    itemId: conversation.listingId ? itemIdByListing.get(conversation.listingId) : undefined,
    messages: messages
      .filter((message) => message.conversationId === conversation.id)
      .map((message) => ({
        id: message.id,
        senderId: message.senderId || "system",
        body: message.body,
        createdAt: new Date(message.createdAt).getTime(),
        system: message.system,
      })),
  }));
  const serverNow =
    typeof serverNowRaw === "number"
      ? serverNowRaw
      : serverNowRaw
        ? new Date(serverNowRaw).getTime()
        : Date.now();
  return {
    viewerId: source.viewerId,
    state: { users, items, listings, notifications, conversations, serverNow },
  };
}

function peso(value?: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}

function countdown(expiresAt: number | undefined, clock: number) {
  if (!expiresAt) return "—";
  const distance = Math.max(0, expiresAt - clock);
  const hours = Math.floor(distance / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  const seconds = Math.floor((distance % 60000) / 1000);
  if (hours > 0) return hours + "h " + String(minutes).padStart(2, "0") + "m";
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cx("brand-lockup", compact && "brand-lockup--compact")} aria-label="OK-OK home">
      <span className="hanger-mark" aria-hidden="true">
        <span />
      </span>
      <span className="brand-word">OK-OK</span>
      {!compact && <span className="brand-tagline">The thrill of the rack, online.</span>}
    </span>
  );
}

function Avatar({ user, size = "md" }: { user?: User; size?: "sm" | "md" | "lg" }) {
  if (!user) return <span className={cx("avatar", "avatar--" + size)}>?</span>;
  return <img className={cx("avatar", "avatar--" + size)} src={user.avatar} alt="" />;
}

function StatusPill({ listing }: { listing: Listing }) {
  const label =
    listing.status === "bidding"
      ? "Live bid"
      : listing.status === "grabbed"
        ? "Grabbed"
        : listing.status.charAt(0).toUpperCase() + listing.status.slice(1);
  return <span className={cx("status-pill", "status-" + listing.status)}>{label}</span>;
}

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <span className="toast-dot">✓</span>
      {message}
    </div>
  );
}

export function OKOKApp() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [state, setState] = useState<MarketState>(initialState);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [clock, setClock] = useState(initialState.serverNow);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverOffset = useRef(0);
  const viewerHydrated = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now() + serverOffset.current), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshMarket() {
      try {
        const response = await fetch("/api/market", { cache: "no-store" });
        if (!response.ok) throw new Error("Demo API unavailable");
        const payload = (await response.json()) as {
          state?: unknown;
          serverNow?: string | number;
        };
        const normalized = normalizeApiState(payload.state, payload.serverNow);
        if (!active || !normalized) return;
        serverOffset.current = normalized.state.serverNow - Date.now();
        setClock(Date.now() + serverOffset.current);
        setState(normalized.state);
        if (isHostedClient()) {
          setCurrentUserId(normalized.viewerId || null);
          viewerHydrated.current = true;
        } else if (!viewerHydrated.current) {
          setCurrentUserId(normalized.viewerId || null);
          viewerHydrated.current = true;
        }
      } catch {
        // Keep the bundled seed visible if the local D1 preview is not ready.
      }
    }
    void refreshMarket();
    const polling = setInterval(refreshMarket, 5000);
    return () => {
      active = false;
      clearInterval(polling);
    };
  }, []);

  function go(path: string) {
    setNoticeOpen(false);
    setProfileOpen(false);
    router.push(path);
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  function itemFor(listing: Listing) {
    return state.items.find((item) => item.id === listing.itemId)!;
  }

  function userFor(id?: string) {
    return state.users.find((user) => user.id === id);
  }

  const currentUser = userFor(currentUserId ?? undefined);
  const userNotices = state.notifications
    .filter((notice) => notice.userId === currentUserId)
    .sort((a, b) => b.createdAt - a.createdAt);

  async function syncAction(
    action: string,
    values: Record<string, unknown>
  ): Promise<{
    ok: boolean;
    notice: string;
    normalized?: { state: MarketState; viewerId?: string };
  }> {
    try {
      const request: Record<string, unknown> = { action };
      if (currentUserId) request.actorId = currentUserId;
      if (typeof values.listingId === "string") request.listingId = values.listingId;
      if (typeof values.amount === "number") request.amount = values.amount;
      if (typeof values.expectedRevision === "number") request.revision = values.expectedRevision;
      if (action === "sendMessage") {
        request.conversationId = values.conversationId;
        request.recipientId = values.recipientId;
        request.body = values.body;
      }
      if (action === "createUser") {
        request.username = values.username;
        request.displayName = values.displayName;
        request.email = values.email;
        request.phone = values.phone;
      }
      if (action === "report") {
        request.reason = values.reason;
        request.details = values.details;
      }
      if (action === "updateProfile") {
        request.displayName = values.displayName;
        request.phone = values.phone;
        request.bio = values.bio;
        request.location = values.location;
        request.preferredTopSize = values.preferredTopSize;
        request.preferredBottomSize = values.preferredBottomSize;
        request.preferredShoeSize = values.preferredShoeSize;
        request.styleTags = values.styleTags;
      }
      if (action === "createListing") {
        const item = values.item as Item;
        const listing = values.listing as Listing;
        request.title = item.title;
        request.description = item.description;
        const canonicalCategory =
          item.category === "Cap" ? "Caps" : item.category === "Jacket" ? "Jackets" : item.category;
        request.category = canonicalCategory;
        request.condition = item.condition;
        request.size = item.size;
        const durableImages = item.images.map((image) =>
          image.startsWith("blob:") ? IMG.jacket : image
        );
        request.imageUrl = durableImages[0];
        request.images = durableImages;
        request.mode = listing.mode === "bid" ? "bidding" : "msg";
        request.minePrice = listing.minePrice;
        request.stealPrice = listing.stealPrice;
        request.grabPrice = listing.grabPrice;
        request.startingBid = listing.startingBid;
        request.bidIncrement = listing.bidIncrement;
        request.durationHours = 24;
      }
      const response = await fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await response.json()) as {
        state?: unknown;
        serverNow?: string | number;
        notice?: string;
      };
      const normalized = normalizeApiState(payload.state, payload.serverNow);
      if (normalized) {
        serverOffset.current = normalized.state.serverNow - Date.now();
        setClock(Date.now() + serverOffset.current);
        setState(normalized.state);
        if (isHostedClient()) {
          setCurrentUserId(normalized.viewerId || null);
        } else if (currentUserId !== null && normalized.viewerId) {
          setCurrentUserId(normalized.viewerId);
        }
      }
      if (!response.ok) {
        return {
          ok: false,
          notice: payload.notice || "That move did not go through.",
          normalized: normalized || undefined,
        };
      }
      return {
        ok: true,
        notice: payload.notice || "Saved.",
        normalized: normalized || undefined,
      };
    } catch (error) {
      return {
        ok: false,
        notice: error instanceof Error ? error.message : "That move did not go through.",
      };
    }
  }

  function requireUser(returnTo: string) {
    if (currentUserId) return true;
    go("/login?returnTo=" + encodeURIComponent(returnTo));
    return false;
  }

  async function actOnListing(listingId: string, action: "mine" | "steal" | "grab", amount?: number) {
    const listing = state.listings.find((row) => row.id === listingId);
    if (!listing || !requireUser("/items/" + listing?.itemId)) return;
    const item = itemFor(listing);
    const timestamp = Date.now();
    let nextStatus: ListingStatus = listing.status;
    let nextExpiry = listing.expiresAt;
    let amountPaid = amount;

    if (action === "mine") {
      if (listing.status !== "available") {
        showToast("This piece is already in play.");
        return;
      }
      nextStatus = "mined";
      nextExpiry = timestamp + 24 * 60 * 60 * 1000;
      amountPaid = listing.minePrice;
    }
    if (action === "steal") {
      if (!["mined", "stolen"].includes(listing.status) || listing.holderId === currentUserId) {
        showToast(listing.holderId === currentUserId ? "You already hold the winning spot." : "Mine it first.");
        return;
      }
      nextStatus = "stolen";
      nextExpiry = timestamp + 10 * 60 * 1000;
      amountPaid = listing.stealPrice;
    }
    if (action === "grab") {
      if (["grabbed", "sold"].includes(listing.status)) {
        showToast("This piece is already sold.");
        return;
      }
      nextStatus = "grabbed";
      nextExpiry = undefined;
      amountPaid = listing.grabPrice;
    }

    const previousHolder = listing.holderId;
    const optimistic: Listing = {
      ...listing,
      status: nextStatus,
      holderId: currentUserId!,
      expiresAt: nextExpiry,
      engagedUserIds: Array.from(new Set([...listing.engagedUserIds, currentUserId!])),
      revision: listing.revision + 1,
    };

    const newNotices: Notice[] = [];
    if (action === "steal" && previousHolder) {
      newNotices.push({
        id: "n-" + timestamp,
        userId: previousHolder,
        title: currentUser?.displayName + " STOLE " + item.title,
        body: "Ten minutes are on the clock. Steal it back or grab it now.",
        itemId: item.id,
        createdAt: timestamp,
        read: false,
        tone: "warning",
      });
    }
    if (action === "grab") {
      newNotices.push({
        id: "n-" + timestamp,
        userId: item.sellerId,
        title: item.title + " was GRABBED",
        body: (currentUser?.displayName || "A buyer") + " secured it for " + peso(amountPaid) + ".",
        itemId: item.id,
        createdAt: timestamp,
        read: false,
        tone: "success",
      });
    }

    const result = await syncAction(action, {
      listingId,
      amount: amountPaid,
      expectedRevision: listing.revision,
    });
    if (!result.ok) {
      showToast(result.notice);
      return;
    }
    if (!result.normalized) {
      setState((current) => ({
        ...current,
        listings: current.listings.map((row) => (row.id === listingId ? optimistic : row)),
        notifications: [...newNotices, ...current.notifications],
      }));
    }
    showToast(result.notice);
  }

  async function placeBid(listingId: string, bid: number) {
    const listing = state.listings.find((row) => row.id === listingId);
    if (!listing || !requireUser("/items/" + listing?.itemId)) return false;
    const minimum = listing.currentBid
      ? listing.currentBid + (listing.bidIncrement ?? 0)
      : (listing.startingBid ?? 0) + (listing.bidIncrement ?? 0);
    if (!Number.isFinite(bid) || bid < minimum) {
      showToast("Next valid bid is " + peso(minimum) + " or more.");
      return false;
    }
    const result = await syncAction("bid", {
      listingId,
      amount: bid,
      expectedRevision: listing.revision,
    });
    if (!result.ok) {
      showToast(result.notice);
      return false;
    }
    if (!result.normalized) {
      setState((current) => ({
        ...current,
        listings: current.listings.map((row) =>
          row.id === listingId
            ? {
                ...row,
                currentBid: bid,
                currentBidderId: currentUserId!,
                engagedUserIds: Array.from(new Set([...row.engagedUserIds, currentUserId!])),
                revision: row.revision + 1,
              }
            : row
        ),
      }));
    }
    showToast(result.notice);
    return true;
  }

  async function messageSeller(listingId: string) {
    const listing = state.listings.find((row) => row.id === listingId);
    if (!listing || !requireUser("/items/" + listing?.itemId)) return;
    const item = itemFor(listing);
    const existing = state.conversations.find(
      (conversation) =>
        conversation.itemId === item.id &&
        conversation.userIds.includes(currentUserId!) &&
        conversation.userIds.includes(item.sellerId)
    );
    if (existing) {
      go("/messages/" + existing.id);
      return;
    }
    const result = await syncAction("sendMessage", {
      listingId,
      recipientId: item.sellerId,
      body: "Hi! I’m interested in " + item.title + ".",
    });
    if (!result.ok) {
      showToast(result.notice);
      return;
    }
    const conversation = result.normalized?.state.conversations.find(
      (row) =>
        row.itemId === item.id &&
        row.userIds.includes(currentUserId!) &&
        row.userIds.includes(item.sellerId)
    );
    showToast(result.notice);
    go(conversation ? "/messages/" + conversation.id : "/messages");
  }

  function login(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    const match =
      state.users.find(
        (user) =>
          user.username.toLowerCase() === normalized ||
          user.email.toLowerCase() === normalized ||
          user.phone.replace(/\s/g, "") === normalized.replace(/\s/g, "")
      ) || state.users[0];
    setCurrentUserId(match.id);
    showToast("Welcome back, " + match.displayName.split(" ")[0] + ".");
    const returnTo =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("returnTo");
    go(returnTo && returnTo.startsWith("/") ? returnTo : "/");
  }

  function logout() {
    if (isHostedClient()) {
      window.location.assign("/signout-with-chatgpt?return_to=%2F");
      return;
    }
    setCurrentUserId(null);
    showToast("You’re logged out.");
    go("/");
  }

  async function createAccount(values: { username: string; phone: string; email: string }) {
    const displayName = values.username
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    const result = await syncAction("createUser", { ...values, displayName });
    if (!result.ok) {
      showToast(result.notice);
      return;
    }
    const persistedUser = result.normalized?.state.users.find(
      (user) => user.email.toLowerCase() === values.email.toLowerCase()
    );
    if (persistedUser) {
      setCurrentUserId(persistedUser.id);
      showToast(result.notice);
      go("/");
      return;
    }
    const id = "u-" + Date.now();
    const user: User = {
      id,
      username: values.username,
      displayName,
      phone: values.phone,
      email: values.email,
      avatar: IMG.avatar3,
      joined: "Today",
    };
    setState((current) => ({ ...current, users: [...current.users, user] }));
    setCurrentUserId(id);
    showToast(result.notice);
    go("/");
  }

  const screenProps = {
    state,
    setState,
    pathname,
    currentUserId,
    currentUser,
    clock,
    category,
    setCategory,
    search,
    go,
    showToast,
    itemFor,
    userFor,
    requireUser,
    actOnListing,
    placeBid,
    messageSeller,
    login,
    logout,
    createAccount,
    syncAction,
  };

  const authPage = pathname === "/login" || pathname === "/signup";

  return (
    <div className="app-frame">
      <Header
        authPage={authPage}
        state={state}
        currentUser={currentUser}
        notices={userNotices}
        noticeOpen={noticeOpen}
        setNoticeOpen={setNoticeOpen}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        category={category}
        setCategory={setCategory}
        search={search}
        setSearch={setSearch}
        go={go}
        logout={logout}
      />
      <main className={cx("page-shell", authPage && "page-shell--auth")}>
        <Screen {...screenProps} />
      </main>
      {!authPage && <Footer go={go} />}
      <Toast message={toast} />
    </div>
  );
}

type HeaderProps = {
  authPage: boolean;
  state: MarketState;
  currentUser?: User;
  notices: Notice[];
  noticeOpen: boolean;
  setNoticeOpen: (value: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (value: boolean) => void;
  category: string;
  setCategory: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  go: (path: string) => void;
  logout: () => void;
};

function Header({
  authPage,
  state,
  currentUser,
  notices,
  noticeOpen,
  setNoticeOpen,
  profileOpen,
  setProfileOpen,
  category,
  setCategory,
  search,
  setSearch,
  go,
  logout,
}: HeaderProps) {
  const unread = notices.filter((notice) => !notice.read).length;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    go("/items");
  }

  return (
    <header className={cx("site-header", authPage && "site-header--auth")}>
      <button className="logo-button" onClick={() => go("/")} aria-label="Go to OK-OK home">
        <Logo compact />
      </button>
      <form className="header-discovery" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="category">
          Category
        </label>
        <select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((value) => (
            <option value={value} key={value}>
              {value === "All" ? "Category" : value}
            </option>
          ))}
        </select>
        <label className="header-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the rack"
            aria-label="Search items"
          />
        </label>
      </form>
      <nav className="header-actions" aria-label="Account actions">
        <div className="popover-wrap">
          <button
            className="icon-button"
            aria-label={"Notifications, " + unread + " unread"}
            aria-expanded={noticeOpen}
            onClick={() => {
              setNoticeOpen(!noticeOpen);
              setProfileOpen(false);
            }}
          >
            <span aria-hidden="true">◔</span>
            {unread > 0 && <b>{unread}</b>}
          </button>
          {noticeOpen && (
            <div className="popover notifications-popover">
              <div className="popover-heading">
                <div>
                  <span className="eyebrow">Live updates</span>
                  <h3>Notifications</h3>
                </div>
                <span className="unread-label">{unread} new</span>
              </div>
              <div className="notification-list">
                {notices.length ? (
                  notices.slice(0, 6).map((notice) => (
                    <button
                      key={notice.id}
                      className={cx("notification-row", !notice.read && "notification-row--unread")}
                      onClick={() => {
                        if (notice.conversationId) go("/messages/" + notice.conversationId);
                        else if (notice.itemId) go("/items/" + notice.itemId);
                      }}
                    >
                      <span className={cx("notice-mark", "notice-mark--" + notice.tone)} />
                      <span>
                        <strong>{notice.title}</strong>
                        <small>{notice.body}</small>
                      </span>
                      <time>{relativeTime(notice.createdAt)}</time>
                    </button>
                  ))
                ) : (
                  <p className="empty-copy">Your rack is quiet for now.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <button className="icon-button" onClick={() => go("/messages")} aria-label="Open messages">
          <span aria-hidden="true">✉</span>
        </button>
        <button className="icon-button cart-button" onClick={() => go("/cart")} aria-label="Open cart">
          <span aria-hidden="true">▱</span>
          {currentUser && <i>{state.listings.filter((row) => row.holderId === currentUser.id).length}</i>}
        </button>
        <div className="popover-wrap">
          <button
            className="profile-trigger"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNoticeOpen(false);
            }}
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <Avatar user={currentUser} size="sm" />
            <span className="profile-trigger-copy">
              <small>{currentUser ? "Hi, " + currentUser.displayName.split(" ")[0] : "Your account"}</small>
              <strong>{currentUser ? "My OK-OK" : "Log in"}</strong>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          {profileOpen && (
            <div className="popover profile-popover">
              {currentUser ? (
                <>
                  <div className="profile-popover-head">
                    <Avatar user={currentUser} />
                    <span>
                      <strong>{currentUser.displayName}</strong>
                      <small>@{currentUser.username}</small>
                    </span>
                  </div>
                  <button onClick={() => go("/profile")}>My profile <span>→</span></button>
                  <button onClick={() => go("/profile/settings")}>Settings <span>→</span></button>
                  <button onClick={logout}>Log out <span>↗</span></button>
                </>
              ) : (
                <>
                  <button onClick={() => go("/login")}>Log in <span>→</span></button>
                  <button onClick={() => go("/signup")}>Create account <span>→</span></button>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

type ScreenProps = {
  state: MarketState;
  setState: React.Dispatch<React.SetStateAction<MarketState>>;
  pathname: string;
  currentUserId: string | null;
  currentUser?: User;
  clock: number;
  category: string;
  setCategory: (value: string) => void;
  search: string;
  go: (path: string) => void;
  showToast: (message: string) => void;
  itemFor: (listing: Listing) => Item;
  userFor: (id?: string) => User | undefined;
  requireUser: (returnTo: string) => boolean;
  actOnListing: (listingId: string, action: "mine" | "steal" | "grab", amount?: number) => Promise<void>;
  placeBid: (listingId: string, bid: number) => Promise<boolean>;
  messageSeller: (listingId: string) => Promise<void>;
  login: (identifier: string) => void;
  logout: () => void;
  createAccount: (values: { username: string; phone: string; email: string }) => Promise<void>;
  syncAction: (
    action: string,
    values: Record<string, unknown>
  ) => Promise<{
    ok: boolean;
    notice: string;
    normalized?: { state: MarketState; viewerId?: string };
  }>;
};

function Screen(props: ScreenProps) {
  const { pathname } = props;
  if (pathname === "/") return <HomePage {...props} />;
  if (pathname === "/login") return <AuthPage mode="login" {...props} />;
  if (pathname === "/signup") return <AuthPage mode="signup" {...props} />;
  if (pathname === "/items") return <ItemsPage {...props} />;
  if (pathname.startsWith("/items/")) return <ItemDetailPage itemId={pathname.split("/")[2]} {...props} />;
  if (pathname === "/cart") return <CartPage {...props} />;
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return <MessagesPage {...props} />;
  if (pathname === "/profile") return <ProfilePage {...props} />;
  if (pathname === "/profile/settings") return <SettingsPage {...props} />;
  if (pathname === "/sell/new") return <SellPage {...props} />;
  return <NotFound go={props.go} />;
}

function Footer({ go }: { go: (path: string) => void }) {
  return (
    <footer className="site-footer">
      <div>
        <Logo compact />
        <p>One-of-one finds. Friendly battles. Less waste.</p>
      </div>
      <div className="footer-links">
        <button onClick={() => go("/items")}>Browse</button>
        <button onClick={() => go("/sell/new")}>Start selling</button>
        <button onClick={() => go("/profile/settings")}>Trust & safety</button>
      </div>
      <small>Made for the Filipino ukay community.</small>
    </footer>
  );
}

function ProductCard({
  listing,
  item,
  seller,
  clock,
  go,
}: {
  listing: Listing;
  item: Item;
  seller?: User;
  clock: number;
  go: (path: string) => void;
}) {
  const price =
    listing.mode === "bid"
      ? listing.currentBid || listing.startingBid
      : listing.status === "grabbed"
        ? listing.grabPrice
        : listing.minePrice;
  return (
    <article className="product-card" onClick={() => go("/items/" + item.id)}>
      <button className="product-image-wrap" aria-label={"View " + item.title}>
        <img src={item.images[0]} alt={item.title} />
        <StatusPill listing={listing} />
        {listing.expiresAt && !["sold", "grabbed"].includes(listing.status) && (
          <span className="card-countdown">{countdown(listing.expiresAt, clock)}</span>
        )}
      </button>
      <div className="product-copy">
        <div>
          <span className="product-category">{item.category} · {item.size}</span>
          <h3>{item.title}</h3>
        </div>
        <button className="save-button" aria-label={"Save " + item.title} onClick={(event) => event.stopPropagation()}>
          ♡
        </button>
      </div>
      <div className="product-meta">
        <span><Avatar user={seller} size="sm" /> {seller?.shopName || seller?.displayName}</span>
        <strong>{listing.mode === "bid" ? "Bid " : "Mine "} {peso(price)}</strong>
      </div>
    </article>
  );
}

function HomePage(props: ScreenProps) {
  const { state, itemFor, userFor, clock, setCategory, go } = props;
  const liveListings = state.listings.filter(
    (listing) => !["sold", "grabbed", "expired"].includes(listing.status)
  );
  const featuredListings = [...(liveListings.length ? liveListings : state.listings)].sort((a, b) => {
    const aPrice = a.currentBid || a.startingBid || a.minePrice || 0;
    const bPrice = b.currentBid || b.startingBid || b.minePrice || 0;
    return bPrice - aPrice;
  });
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featured = featuredListings[featuredIndex % Math.max(1, featuredListings.length)];
  if (!featured) {
    return (
      <section className="empty-state">
        <span className="eyebrow">The rack is getting ready</span>
        <h1>No live pieces yet.</h1>
        <p>Check back for the next community drop, or be the first to list one.</p>
        <button className="button button--coral" onClick={() => go("/sell/new")}>
          List a piece
        </button>
      </section>
    );
  }
  const featuredItem = itemFor(featured);
  const newDrops = liveListings.slice(0, 6);

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow eyebrow--light">The rack is live</span>
          <h1>Your next favorite piece is already <em>worn in.</em></h1>
          <p>
            Curated ukay finds, one friendly battle at a time. Mine it, steal the spot, or grab it
            before anyone else can.
          </p>
          <div className="hero-actions">
            <button className="button button--coral" onClick={() => go("/items")}>
              Shop the latest drop <span>↗</span>
            </button>
            <button className="text-link text-link--light" onClick={() => go("/sell/new")}>
              Sell from your rack <span>→</span>
            </button>
          </div>
          <div className="trust-strip">
            <span><strong>2.4k</strong> thrift lovers</span>
            <span><strong>860+</strong> pieces rehomed</span>
            <span><strong>4.9</strong> community score</span>
          </div>
        </div>
        <div className="hero-carousel">
          <button className="hero-product" onClick={() => go("/items/" + featuredItem.id)}>
            <img src={featuredItem.images[0]} alt={featuredItem.title} />
            <span className="hero-sticker">
              {featuredIndex === 0 ? "Highest live value" : "More live finds"}
            </span>
            <div className="hero-product-overlay">
              <span>{featuredItem.category} · {featuredItem.size}</span>
              <h2>{featuredItem.title}</h2>
              <div>
                <strong>
                  {featured.mode === "bid" ? "Current bid " : "Mine now "}
                  {peso(featured.currentBid || featured.startingBid || featured.minePrice)}
                </strong>
                <span className="circle-arrow">↗</span>
              </div>
            </div>
          </button>
          <div className="hero-carousel-controls" aria-label="Featured item carousel">
            <button
              aria-label="Previous featured item"
              onClick={() =>
                setFeaturedIndex(
                  (featuredIndex - 1 + featuredListings.length) % featuredListings.length
                )
              }
            >
              ←
            </button>
            <span>
              {String(featuredIndex + 1).padStart(2, "0")} /{" "}
              {String(featuredListings.length).padStart(2, "0")}
            </span>
            <button
              aria-label="Next featured item"
              onClick={() => setFeaturedIndex((featuredIndex + 1) % featuredListings.length)}
            >
              →
            </button>
          </div>
        </div>
      </section>

      <section className="category-ribbon" aria-label="Shop by category">
        {categories.slice(1).map((value, index) => (
          <button
            key={value}
            onClick={() => {
              setCategory(value);
              go("/items");
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {value}
          </button>
        ))}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fresh from the community</span>
            <h2>New on the rack</h2>
          </div>
          <button className="text-link" onClick={() => go("/items")}>See all pieces <span>→</span></button>
        </div>
        <div className="product-grid">
          {newDrops.map((listing) => {
            const item = itemFor(listing);
            return (
              <ProductCard
                key={listing.id}
                listing={listing}
                item={item}
                seller={userFor(item.sellerId)}
                clock={clock}
                go={go}
              />
            );
          })}
        </div>
      </section>

      <section className="how-it-works">
        <div className="how-intro">
          <span className="eyebrow eyebrow--light">MSG explained</span>
          <h2>See it. Call it. Keep it.</h2>
          <p>Every listing tells you exactly how bold to be.</p>
        </div>
        <div className="move-cards">
          <article className="move-card move-card--mine">
            <span>01</span><h3>Mine</h3><p>Claim the lowest tier and start a 24-hour timer.</p>
          </article>
          <article className="move-card move-card--steal">
            <span>02</span><h3>Steal</h3><p>Take the winning spot. The clock becomes a 10-minute sprint.</p>
          </article>
          <article className="move-card move-card--grab">
            <span>03</span><h3>Grab</h3><p>Skip the drama. Pay the top tier and lock the piece instantly.</p>
          </article>
        </div>
      </section>
    </>
  );
}

function AuthPage({ mode, login, createAccount, go }: ScreenProps & { mode: "login" | "signup" }) {
  const [identifier, setIdentifier] = useState("ana@example.com");
  const [password, setPassword] = useState("demo1234");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const hostname = typeof window === "undefined" ? "" : window.location.hostname;
    const localDemo =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (!localDemo) {
      const returnTo = mode === "signup" ? "/profile/settings" : "/";
      window.location.assign(
        "/signin-with-chatgpt?return_to=" + encodeURIComponent(returnTo)
      );
      return;
    }
    if (mode === "login") {
      if (!identifier.trim() || !password) {
        setError("Enter your account and password.");
        return;
      }
      login(identifier);
      return;
    }
    if (!username || !phone || !email || !password || !confirm) {
      setError("Complete every field to join the rack.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match yet.");
      return;
    }
    void createAccount({ username, phone, email });
  }

  return (
    <section className="auth-layout">
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <Logo />
          <span className="auth-kicker">A better home for pre-loved clothes</span>
          <h1>Find the piece that feels like it was waiting for you.</h1>
          <div className="auth-rack-art">
            <img src={IMG.jacket} alt="Brown vintage jacket on a rack" />
            <span className="auth-price-tag">one-of-one finds<br /><strong>from ₱250</strong></span>
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-heading">
            <span className="eyebrow">{mode === "login" ? "Welcome back" : "Join the community"}</span>
            <h2>{mode === "login" ? "Log in to your rack" : "Create your OK-OK account"}</h2>
            <p>
              {mode === "login"
                ? "Your battles, bids, and messages are right where you left them."
                : "Save your sizes, join live battles, and start your own thrift shop."}
            </p>
          </div>

          {mode === "login" ? (
            <>
              <label>
                Username, phone, or email
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </label>
              <label>
                <span>Password <button type="button" className="inline-link">Forgot?</button></span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
            </>
          ) : (
            <div className="signup-fields">
              <label>
                Username
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="yourhandle" />
              </label>
              <label>
                Phone number
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" />
              </label>
              <label className="field-wide">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repeat password"
                />
              </label>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--brown button--full" type="submit">
            {mode === "login" ? "Log in" : "Create account"} <span>→</span>
          </button>
          {mode === "login" && (
            <p className="demo-hint">
              Demo ready: use <strong>ana@example.com</strong> with any password.
            </p>
          )}
          <div className="auth-divider"><span>or</span></div>
          <button
            className="chatgpt-auth-button"
            type="button"
            onClick={() => window.location.assign("/signin-with-chatgpt?return_to=%2F")}
          >
            <span className="chatgpt-mark">✣</span> Continue with ChatGPT
          </button>
          <p className="auth-switch">
            {mode === "login" ? "New to OK-OK?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => go(mode === "login" ? "/signup" : "/login")}>
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
          <small className="legal-copy">
            By continuing, you agree to OK-OK’s community guidelines and marketplace policies.
          </small>
        </form>
      </div>
    </section>
  );
}

function ItemsPage(props: ScreenProps) {
  const { state, category, search, clock, itemFor, userFor, go } = props;
  const [sort, setSort] = useState("fresh");
  const [modeFilter, setModeFilter] = useState<"all" | ListingMode>("all");
  const [sizeFilter, setSizeFilter] = useState("All sizes");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = state.listings.filter((listing) => {
      const item = itemFor(listing);
      const categoryMatch = category === "All" || item.category === category;
      const queryMatch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.includes(query));
      const modeMatch = modeFilter === "all" || listing.mode === modeFilter;
      const sizeMatch = sizeFilter === "All sizes" || item.size === sizeFilter;
      return categoryMatch && queryMatch && modeMatch && sizeMatch;
    });
    return [...rows].sort((a, b) => {
      if (sort === "ending") return (a.expiresAt || Infinity) - (b.expiresAt || Infinity);
      if (sort === "price-low") {
        const priceA = a.mode === "bid" ? a.currentBid || a.startingBid || 0 : a.minePrice || 0;
        const priceB = b.mode === "bid" ? b.currentBid || b.startingBid || 0 : b.minePrice || 0;
        return priceA - priceB;
      }
      return b.revision - a.revision;
    });
  }, [state, category, search, modeFilter, sizeFilter, sort, itemFor]);

  return (
    <section className="browse-page content-section">
      <div className="browse-hero">
        <div>
          <span className="eyebrow">All pieces</span>
          <h1>Browse the rack</h1>
          <p>Every item is pre-loved, checked, and ready for its next story.</p>
        </div>
        <div className="browse-count">
          <strong>{filtered.length}</strong>
          <span>finds in this drop</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="segmented-control" aria-label="Selling mode">
          <button className={modeFilter === "all" ? "active" : ""} onClick={() => setModeFilter("all")}>All</button>
          <button className={modeFilter === "msg" ? "active" : ""} onClick={() => setModeFilter("msg")}>Mine / Steal / Grab</button>
          <button className={modeFilter === "bid" ? "active" : ""} onClick={() => setModeFilter("bid")}>Bidding</button>
        </div>
        <div className="select-group">
          <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)} aria-label="Filter by size">
            <option>All sizes</option>
            {Array.from(new Set(state.items.map((item) => item.size))).map((size) => <option key={size}>{size}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items">
            <option value="fresh">Fresh first</option>
            <option value="ending">Ending soon</option>
            <option value="price-low">Price: low to high</option>
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="product-grid product-grid--browse">
          {filtered.map((listing) => {
            const item = itemFor(listing);
            return (
              <ProductCard
                key={listing.id}
                listing={listing}
                item={item}
                seller={userFor(item.sellerId)}
                clock={clock}
                go={go}
              />
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">⌕</span>
          <h2>No pieces match that fit.</h2>
          <p>Try another category, size, or search phrase.</p>
        </div>
      )}
    </section>
  );
}

function ItemDetailPage(props: ScreenProps & { itemId: string }) {
  const {
    itemId,
    state,
    currentUserId,
    currentUser,
    clock,
    userFor,
    go,
    actOnListing,
    placeBid,
    messageSeller,
    showToast,
    syncAction,
    requireUser,
  } = props;
  const item = state.items.find((row) => row.id === itemId);
  const listing = state.listings.find((row) => row.itemId === itemId);
  const [activeImage, setActiveImage] = useState(0);
  const [bid, setBid] = useState("");

  if (!item || !listing) return <NotFound go={go} />;
  const seller = userFor(item.sellerId);
  const holder = userFor(listing.holderId || listing.currentBidderId);
  const minimumBid = listing.currentBid
    ? listing.currentBid + (listing.bidIncrement || 0)
    : (listing.startingBid || 0) + (listing.bidIncrement || 0);
  const expired = listing.status === "expired";
  const sold = ["grabbed", "sold", "expired"].includes(listing.status);
  const heldByYou = listing.holderId === currentUserId;
  const preferredSize =
    item.category === "Shoes"
      ? currentUser?.preferredShoeSize
      : ["Pants", "Shorts"].includes(item.category)
        ? currentUser?.preferredBottomSize
        : currentUser?.preferredTopSize;

  async function submitBid(event: FormEvent) {
    event.preventDefault();
    const success = await placeBid(listing!.id, Number(bid));
    if (success) setBid("");
  }

  return (
    <section className="item-page content-section">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <button onClick={() => go("/")}>Home</button><span>/</span>
        <button onClick={() => go("/items")}>{item.category}</button><span>/</span>
        <strong>{item.title}</strong>
      </nav>

      <div className="item-detail-grid">
        <div className="gallery">
          <div className="gallery-main">
            <img src={item.images[activeImage] || item.images[0]} alt={item.title} />
            <span className="photo-note">Pre-loved, photographed by the seller</span>
          </div>
          <div className="gallery-thumbs">
            {item.images.map((image, index) => (
              <button
                className={index === activeImage ? "active" : ""}
                onClick={() => setActiveImage(index)}
                key={image + index}
                aria-label={"View image " + (index + 1)}
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="item-purchase">
          <div className="item-title-row">
            <div>
              <span className="eyebrow">{item.category} · {item.condition}</span>
              <h1>{item.title}</h1>
            </div>
            <button className="round-save" aria-label="Save item">♡</button>
          </div>

          <div className="seller-strip">
            <Avatar user={seller} />
            <span>
              <small>Sold by</small>
              <strong>{seller?.shopName || seller?.displayName}</strong>
            </span>
            <span className="seller-rating">★ 4.9 <small>127 sales</small></span>
          </div>

          <p className="item-description">{item.description}</p>
          <dl className="item-facts">
            <div><dt>Size</dt><dd>{item.size}</dd></div>
            <div><dt>Condition</dt><dd>{item.condition}</dd></div>
            <div><dt>Color</dt><dd>{item.color}</dd></div>
          </dl>
          <div className="tag-list">
            {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          {preferredSize && preferredSize === item.size ? (
            <div className="fit-match"><span>✓</span><div><strong>Fit match</strong><small>This matches a size in your style profile.</small></div></div>
          ) : null}

          <div className="buy-panel">
            <div className="buy-panel-head">
              <div>
                <span className="eyebrow">{listing.mode === "msg" ? "Mine · Steal · Grab" : "Live bidding"}</span>
                <h2>
                  {expired
                    ? "This listing has ended"
                    : sold
                      ? "This piece is secured"
                      : listing.mode === "msg"
                        ? "Make your move"
                        : "Place your bid"}
                </h2>
              </div>
              <StatusPill listing={listing} />
            </div>

            {listing.expiresAt && !sold && (
              <div className="live-timer">
                <span className="pulse-dot" />
                <span>{listing.mode === "bid" ? "Bidding closes in" : "Winning spot settles in"}</span>
                <strong>{countdown(listing.expiresAt, clock)}</strong>
              </div>
            )}

            {holder && (
              <div className="current-holder">
                <Avatar user={holder} size="sm" />
                <span>
                  <small>{listing.mode === "bid" ? "Highest bidder" : "Winning spot"}</small>
                  <strong>{holder.id === currentUserId ? "You’re currently leading" : holder.displayName + " is leading"}</strong>
                </span>
              </div>
            )}

            {listing.mode === "msg" ? (
              <div className="msg-actions">
                <button
                  className="price-action price-action--mine"
                  disabled={listing.status !== "available" || sold}
                  onClick={() => actOnListing(listing.id, "mine", listing.minePrice)}
                >
                  <span><b>Mine</b><small>Start 24h clock</small></span>
                  <strong>{peso(listing.minePrice)}</strong>
                </button>
                <button
                  className="price-action price-action--steal"
                  disabled={!["mined", "stolen"].includes(listing.status) || heldByYou || sold}
                  onClick={() => actOnListing(listing.id, "steal", listing.stealPrice)}
                >
                  <span><b>{heldByYou ? "You hold it" : "Steal"}</b><small>Take the spot · 10m</small></span>
                  <strong>{peso(listing.stealPrice)}</strong>
                </button>
                <button
                  className="price-action price-action--grab"
                  disabled={sold}
                  onClick={() => actOnListing(listing.id, "grab", listing.grabPrice)}
                >
                  <span><b>Grab</b><small>Instant buyout</small></span>
                  <strong>{peso(listing.grabPrice)}</strong>
                </button>
              </div>
            ) : (
              <form className="bid-form" onSubmit={submitBid}>
                <div className="bid-summary">
                  <span><small>Current bid</small><strong>{peso(listing.currentBid || listing.startingBid)}</strong></span>
                  <span><small>Minimum step</small><strong>+{peso(listing.bidIncrement)}</strong></span>
                </div>
                <label>
                  Your bid
                  <span className="money-input"><b>₱</b><input
                    inputMode="numeric"
                    value={bid}
                    onChange={(event) => setBid(event.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={String(minimumBid)}
                    disabled={sold}
                  /></span>
                </label>
                <button className="button button--brown button--full" type="submit" disabled={sold}>
                  Bid {peso(minimumBid)} or more <span>→</span>
                </button>
                <small className="bid-rule">Bids below the {peso(listing.bidIncrement)} increment are automatically declined.</small>
              </form>
            )}

            <div className="buyer-protection">
              <span>◇</span>
              <p><strong>OK-OK buyer protection</strong><br />Payment is released after you confirm the item arrives as described.</p>
            </div>
          </div>
          <div className="item-secondary-actions">
            <button onClick={() => void messageSeller(listing.id)}>✉ Ask the seller</button>
            <button
              onClick={async () => {
                if (!requireUser("/items/" + item.id)) return;
                const result = await syncAction("report", {
                  listingId: listing.id,
                  reason: "Listing concern",
                  details: "Reported from the item page.",
                });
                showToast(result.notice);
              }}
            >
              ⚑ Report listing
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignInGate({ go, title }: { go: (path: string) => void; title: string }) {
  return (
    <section className="signin-gate">
      <div className="signin-gate-art"><span>OK</span><span>OK</span></div>
      <span className="eyebrow">Your rack, your account</span>
      <h1>{title}</h1>
      <p>Log in to keep your live battles, secured pieces, and conversations together.</p>
      <div>
        <button className="button button--brown" onClick={() => go("/login")}>Log in <span>→</span></button>
        <button className="text-link" onClick={() => go("/signup")}>Create an account</button>
      </div>
    </section>
  );
}

function CartItem({
  listing,
  item,
  seller,
  clock,
  currentUserId,
  go,
  actOnListing,
  messageSeller,
  syncAction,
  showToast,
}: {
  listing: Listing;
  item: Item;
  seller?: User;
  clock: number;
  currentUserId: string | null;
  go: (path: string) => void;
  actOnListing: ScreenProps["actOnListing"];
  messageSeller: ScreenProps["messageSeller"];
  syncAction: ScreenProps["syncAction"];
  showToast: (message: string) => void;
}) {
  const lost = listing.engagedUserIds.includes(currentUserId || "") &&
    listing.holderId !== currentUserId &&
    listing.mode === "msg";
  const secured = ["grabbed", "sold"].includes(listing.status);
  return (
    <article className="cart-item">
      <button className="cart-item-image" onClick={() => go("/items/" + item.id)}>
        <img src={item.images[0]} alt={item.title} />
        <StatusPill listing={listing} />
      </button>
      <div className="cart-item-copy">
        <span className="product-category">{item.category} · {item.size}</span>
        <h3>{item.title}</h3>
        <p>{seller?.shopName || seller?.displayName}</p>
        {listing.expiresAt && !secured && (
          <div className="cart-timer"><span>Time left</span><strong>{countdown(listing.expiresAt, clock)}</strong></div>
        )}
        <div className="cart-price">
          <span>{listing.mode === "bid" ? "Your leading bid" : secured ? "Secured for" : "Current tier"}</span>
          <strong>
            {peso(
              listing.mode === "bid"
                ? listing.currentBid
                : secured
                  ? listing.soldPrice || listing.grabPrice || listing.stealPrice || listing.minePrice
                  : listing.status === "stolen"
                    ? listing.stealPrice
                    : listing.minePrice
            )}
          </strong>
        </div>
        <div className="cart-item-actions">
          {lost && (
            <button className="mini-action mini-action--steal" onClick={() => actOnListing(listing.id, "steal")}>
              Steal back
            </button>
          )}
          {!secured && listing.mode === "msg" && (
            <button className="mini-action mini-action--grab" onClick={() => actOnListing(listing.id, "grab")}>
              Grab
            </button>
          )}
          {secured && <button className="mini-action mini-action--checkout" onClick={() => showToast("Checkout is ready for this secured piece.")}>Checkout</button>}
          <button className="mini-action" onClick={() => void messageSeller(listing.id)}>Message</button>
          <button
            className="mini-icon"
            onClick={async () => {
              const result = await syncAction("report", {
                listingId: listing.id,
                reason: "Cart concern",
                details: "Reported from the cart.",
              });
              showToast(result.notice);
            }}
            aria-label="Report item"
          >
            ⚑
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPage(props: ScreenProps) {
  const { state, currentUserId, clock, itemFor, userFor, go, actOnListing, showToast } = props;
  const [activeMobileSection, setActiveMobileSection] = useState("secured");
  if (!currentUserId) return <SignInGate go={go} title="Log in to see your cart" />;

  const secured = state.listings.filter((listing) => {
    const section = listing.cartSections?.[currentUserId];
    return (
      section === "secured" ||
      (!section &&
        ["grabbed", "sold"].includes(listing.status) &&
        (listing.holderId === currentUserId || listing.currentBidderId === currentUserId))
    );
  });
  const active = state.listings.filter((listing) => {
    const section = listing.cartSections?.[currentUserId];
    return (
      section === "active" ||
      (!section &&
        ((listing.holderId === currentUserId && ["mined", "stolen"].includes(listing.status)) ||
          (listing.currentBidderId === currentUserId && listing.status === "bidding")))
    );
  });
  const lost = state.listings.filter((listing) => {
    const section = listing.cartSections?.[currentUserId];
    return (
      section === "lost" ||
      (!section &&
        listing.mode === "msg" &&
        listing.engagedUserIds.includes(currentUserId) &&
        listing.holderId !== currentUserId &&
        ["mined", "stolen"].includes(listing.status))
    );
  });

  const sections = [
    {
      id: "secured",
      number: "01",
      title: "Secured / Locked",
      subtitle: "Yours. Ready for checkout.",
      items: secured,
      tone: "green",
    },
    {
      id: "active",
      number: "02",
      title: "Active battles",
      subtitle: "You hold the winning spot.",
      items: active,
      tone: "orange",
    },
    {
      id: "lost",
      number: "03",
      title: "Lost",
      subtitle: "Somebody took the spot.",
      items: lost,
      tone: "red",
    },
  ];

  return (
    <section className="cart-page content-section">
      <div className="page-title-row">
        <div><span className="eyebrow">Your live rack</span><h1>Cart & battles</h1><p>Track every piece you’ve secured, lead, or lost.</p></div>
        <button className="button button--outline" onClick={() => go("/items")}>Keep browsing <span>→</span></button>
      </div>
      <div className="cart-mobile-tabs">
        {sections.map((section) => (
          <button
            key={section.id}
            className={activeMobileSection === section.id ? "active" : ""}
            onClick={() => setActiveMobileSection(section.id)}
          >
            {section.title} <span>{section.items.length}</span>
          </button>
        ))}
      </div>
      <div className="cart-columns">
        {sections.map((section) => (
          <section
            className={cx("cart-column", "cart-column--" + section.tone, activeMobileSection === section.id && "cart-column--mobile-active")}
            key={section.id}
          >
            <div className="cart-column-head">
              <span>{section.number}</span>
              <div><h2>{section.title}</h2><p>{section.subtitle}</p></div>
              <strong>{section.items.length}</strong>
            </div>
            <div className="cart-column-items">
              {section.items.length ? (
                section.items.map((listing) => {
                  const item = itemFor(listing);
                  return (
                    <CartItem
                      key={listing.id}
                      listing={listing}
                      item={item}
                      seller={userFor(item.sellerId)}
                      clock={clock}
                      currentUserId={currentUserId}
                      go={go}
                      actOnListing={actOnListing}
                      messageSeller={props.messageSeller}
                      syncAction={props.syncAction}
                      showToast={showToast}
                    />
                  );
                })
              ) : (
                <div className="column-empty"><span>◌</span><p>No items here right now.</p></div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function MessagesPage(props: ScreenProps) {
  const { state, setState, pathname, currentUserId, userFor, go, clock, showToast, syncAction } = props;
  const [message, setMessage] = useState("");
  if (!currentUserId) return <SignInGate go={go} title="Log in to open your inbox" />;

  const conversations = state.conversations.filter((conversation) => conversation.userIds.includes(currentUserId));
  const pathId = pathname.split("/")[2];
  const active = conversations.find((conversation) => conversation.id === pathId) || conversations[0];
  const partnerId = active?.userIds.find((id) => id !== currentUserId);
  const partner = userFor(partnerId);
  const item = state.items.find((row) => row.id === active?.itemId);
  const listing = state.listings.find((row) => row.itemId === item?.id);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!body || !active) return;
    const result = await syncAction("sendMessage", { conversationId: active.id, body });
    if (!result.ok) {
      showToast(result.notice);
      return;
    }
    const newMessage: Message = {
      id: "m-local-" + active.id + "-" + (active.messages.length + 1),
      senderId: currentUserId!,
      body,
      createdAt: clock,
    };
    if (!result.normalized) {
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === active.id
            ? { ...conversation, messages: [...conversation.messages, newMessage] }
            : conversation
        ),
      }));
    }
    setMessage("");
  }

  return (
    <section className="messages-page">
      <aside className="inbox-panel">
        <div className="inbox-heading">
          <div><span className="eyebrow">Your messages</span><h1>Inbox</h1></div>
          <button onClick={() => go("/items")} aria-label="Start a new item conversation">＋</button>
        </div>
        <label className="inbox-search"><span>⌕</span><input placeholder="Search conversations" /></label>
        <div className="thread-list">
          {conversations.map((conversation) => {
            const other = userFor(conversation.userIds.find((id) => id !== currentUserId));
            const last = conversation.messages[conversation.messages.length - 1];
            return (
              <button
                key={conversation.id}
                className={cx("thread-row", active?.id === conversation.id && "thread-row--active")}
                onClick={() => go("/messages/" + conversation.id)}
              >
                <Avatar user={other} />
                <span className="thread-copy">
                  <span><strong>{other?.shopName || other?.displayName}</strong><time>{last ? relativeTime(last.createdAt) : "New"}</time></span>
                  <small>{last?.body || "Start the conversation"}</small>
                </span>
                {conversation.id === conversations[0]?.id && <i />}
              </button>
            );
          })}
        </div>
      </aside>

      {active ? (
        <div className="conversation-panel">
          <header className="conversation-head">
            <Avatar user={partner} />
            <div><strong>{partner?.displayName}</strong><span><i /> Usually replies in a few minutes</span></div>
            <button onClick={() => item && go("/items/" + item.id)}>View listing ↗</button>
          </header>
          {item && listing && (
            <button className="conversation-item-card" onClick={() => go("/items/" + item.id)}>
              <img src={item.images[0]} alt="" />
              <span><small>ITEM IN THIS CHAT</small><strong>{item.title} · {item.size}</strong><em>{listing.mode === "bid" ? "Current bid " + peso(listing.currentBid) : "Grab " + peso(listing.grabPrice)}</em></span>
              <span>→</span>
            </button>
          )}
          <div className="message-thread" aria-live="polite">
            <div className="date-divider"><span>Today</span></div>
            {active.messages.map((row) =>
              row.system ? (
                <div className="system-message" key={row.id}><span>✓</span><p>{row.body}</p></div>
              ) : (
                <div className={cx("message-bubble-row", row.senderId === currentUserId && "message-bubble-row--mine")} key={row.id}>
                  {row.senderId !== currentUserId && <Avatar user={partner} size="sm" />}
                  <div className="message-bubble"><p>{row.body}</p><time>{relativeTime(row.createdAt)}</time></div>
                </div>
              )
            )}
          </div>
          <form className="message-composer" onSubmit={send}>
            <button type="button" aria-label="Attach photo">＋</button>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message..." />
            <button className="send-button" type="submit" aria-label="Send message">↗</button>
          </form>
        </div>
      ) : (
        <div className="no-conversation"><span>✉</span><h2>Choose a conversation</h2></div>
      )}
    </section>
  );
}

function ProfilePage(props: ScreenProps) {
  const { state, currentUser, currentUserId, itemFor, userFor, go } = props;
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  if (!currentUser || !currentUserId) return <SignInGate go={go} title="Log in to see your profile" />;

  const involved = state.listings.filter((listing) => listing.engagedUserIds.includes(currentUserId));
  const purchased = state.listings.filter(
    (listing) => ["grabbed", "sold"].includes(listing.status) && (listing.holderId === currentUserId || listing.currentBidderId === currentUserId)
  );
  const selling = state.listings.filter((listing) => itemFor(listing).sellerId === currentUserId);
  const activeSelling = selling.filter(
    (listing) => !["sold", "grabbed", "expired"].includes(listing.status)
  );
  const soldBySeller = selling.filter((listing) =>
    ["sold", "grabbed"].includes(listing.status)
  );
  const sellerSalesTotal = soldBySeller.reduce(
    (total, listing) => total + (listing.soldPrice || listing.currentBid || listing.grabPrice || 0),
    0
  );
  const sellerForItem = (listing: Listing) => userFor(itemFor(listing).sellerId);
  const favoriteShops = state.users.filter((user) => user.shopName).slice(0, 5);

  const stats = [
    ["Mined", involved.filter((row) => row.mode === "msg" && row.status === "mined").length],
    ["Stolen", involved.filter((row) => row.mode === "msg" && row.status === "stolen").length],
    ["Grabbed", purchased.filter((row) => row.mode === "msg").length],
    ["Bidded", involved.filter((row) => row.mode === "bid").length],
  ];

  return (
    <section className="profile-page content-section">
      <div className="profile-cover">
        <div className="profile-identity">
          <Avatar user={currentUser} size="lg" />
          <div><span className="eyebrow">Member since {currentUser.joined}</span><h1>{currentUser.displayName}</h1><p>@{currentUser.username} · Metro Manila</p></div>
          <button className="button button--cream" onClick={() => go("/profile/settings")}>Edit profile</button>
        </div>
        <div className="profile-score"><span>Community score</span><strong>4.9</strong><small>★ 83 reviews</small></div>
      </div>
      <div className="role-switch">
        <button className={role === "buyer" ? "active" : ""} onClick={() => setRole("buyer")}>Buyer profile</button>
        <button className={role === "seller" ? "active" : ""} onClick={() => setRole("seller")}>Seller profile</button>
      </div>

      {role === "buyer" ? (
        <>
          <div className="profile-stats">
            {stats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
            <div className="style-card"><span>Preferred fit</span><strong>Tops {currentUser.preferredTopSize || "—"} · Bottoms {currentUser.preferredBottomSize || "—"}</strong><button onClick={() => go("/profile/settings")}>Edit sizes</button></div>
          </div>
          <div className="profile-dashboard-grid">
            <section className="history-panel">
              <div className="panel-heading"><div><span className="eyebrow">Your finds</span><h2>Purchase history</h2></div><button>Download receipt</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Piece</th><th>Method</th><th>Shop</th><th>Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {purchased.slice(0, 6).map((listing) => {
                      const item = itemFor(listing);
                      return (
                        <tr key={listing.id}>
                          <td><span className="table-item"><img src={item.images[0]} alt="" /><span><strong>{item.title}</strong><small>{item.category} · {item.size}</small></span></span></td>
                          <td>{listing.mode === "bid" ? "Bidding" : listing.status === "grabbed" ? "Grab" : "Mine"}</td>
                          <td>{sellerForItem(listing)?.shopName}</td>
                          <td>{peso(listing.mode === "bid" ? listing.currentBid : listing.grabPrice || listing.minePrice)}</td>
                          <td><span className="delivery-status">In transit</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <aside className="favorite-shops">
              <div><span className="eyebrow">On repeat</span><h2>Your top shops</h2></div>
              {favoriteShops.map((shop, index) => (
                <button key={shop.id}><span>{String(index + 1).padStart(2, "0")}</span><Avatar user={shop} /><strong>{shop.shopName}</strong><em>→</em></button>
              ))}
              <button className="discover-shops" onClick={() => go("/items")}>Discover more shops</button>
            </aside>
          </div>
        </>
      ) : (
        <div className="seller-dashboard">
          <div className="seller-summary-row">
            <div><span>Active listings</span><strong>{activeSelling.length}</strong><small>Across MSG and bidding</small></div>
            <div><span>Sales total</span><strong>{peso(sellerSalesTotal)}</strong><small>From settled listings</small></div>
            <div><span>Pieces rehomed</span><strong>{soldBySeller.length}</strong><small>Since {currentUser.joined}</small></div>
            <button onClick={() => go("/sell/new")}><span>＋</span><strong>Create listing</strong><small>Add a piece from your rack</small></button>
          </div>
          <section className="history-panel">
            <div className="panel-heading"><div><span className="eyebrow">Your shop</span><h2>Active listings</h2></div><button onClick={() => go("/sell/new")}>Add new item</button></div>
            {activeSelling.length ? (
              <div className="table-wrap"><table><thead><tr><th>Piece</th><th>Category</th><th>Listing</th><th>Current value</th><th></th></tr></thead><tbody>
                {activeSelling.map((listing) => {
                  const item = itemFor(listing);
                  return <tr key={listing.id}><td><span className="table-item"><img src={item.images[0]} alt="" /><strong>{item.title}</strong></span></td><td>{item.category}</td><td>{listing.mode === "msg" ? "MSG" : "Bidding"}</td><td>{peso(listing.currentBid || listing.minePrice)}</td><td><button className="table-action">Edit</button></td></tr>;
                })}
              </tbody></table></div>
            ) : (
              <div className="seller-empty"><span>◇</span><h3>Your shop is ready for its first piece.</h3><button onClick={() => go("/sell/new")}>Create a listing</button></div>
            )}
          </section>
          <section className="history-panel seller-sales-history">
            <div className="panel-heading"><div><span className="eyebrow">Completed</span><h2>Sales history</h2></div></div>
            {soldBySeller.length ? (
              <div className="table-wrap"><table><thead><tr><th>Piece</th><th>Method</th><th>Final value</th><th>Status</th></tr></thead><tbody>
                {soldBySeller.map((listing) => {
                  const item = itemFor(listing);
                  return <tr key={listing.id}><td><span className="table-item"><img src={item.images[0]} alt="" /><strong>{item.title}</strong></span></td><td>{listing.mode === "bid" ? "Bidding" : "MSG"}</td><td>{peso(listing.soldPrice || listing.currentBid || listing.grabPrice)}</td><td><span className="delivery-status">Secured</span></td></tr>;
                })}
              </tbody></table></div>
            ) : (
              <div className="seller-empty"><span>◇</span><h3>Completed sales will appear here.</h3></div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function SettingsPage(props: ScreenProps) {
  const { state, currentUser, currentUserId, go, logout, showToast, syncAction } = props;
  const [tab, setTab] = useState("Edit profile");
  const [name, setName] = useState(currentUser?.displayName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [location, setLocation] = useState(currentUser?.location || "");
  const [topSize, setTopSize] = useState(currentUser?.preferredTopSize || "M");
  const [bottomSize, setBottomSize] = useState(currentUser?.preferredBottomSize || "29");
  const [shoeSize, setShoeSize] = useState(currentUser?.preferredShoeSize || "EU 39");
  const [styleTags, setStyleTags] = useState<string[]>(currentUser?.styleTags || []);
  const draftOwnerRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (draftOwnerRef.current === currentUser?.id) return;
    draftOwnerRef.current = currentUser?.id;
    setName(currentUser?.displayName || "");
    setEmail(currentUser?.email || "");
    setPhone(currentUser?.phone || "");
    setBio(currentUser?.bio || "");
    setLocation(currentUser?.location || "");
    setTopSize(currentUser?.preferredTopSize || "M");
    setBottomSize(currentUser?.preferredBottomSize || "29");
    setShoeSize(currentUser?.preferredShoeSize || "EU 39");
    setStyleTags(currentUser?.styleTags || []);
  }, [currentUser]);
  if (!currentUser || !currentUserId) return <SignInGate go={go} title="Log in to change your settings" />;
  const tabs = ["Edit profile", "Style & sizes", "Change password", "Policies", "Report a concern"];

  async function save(event: FormEvent) {
    event.preventDefault();
    if (tab === "Report a concern") {
      const listing = state.listings[0];
      if (!listing) {
        showToast("There is no listing to attach to this report.");
        return;
      }
      const result = await syncAction("report", {
        listingId: listing.id,
        reason: "Marketplace concern",
        details: "Submitted from account settings.",
      });
      showToast(result.notice);
      return;
    }
    const result = await syncAction("updateProfile", {
      displayName: name,
      phone,
      bio,
      location,
      preferredTopSize: topSize,
      preferredBottomSize: bottomSize,
      preferredShoeSize: shoeSize,
      styleTags,
    });
    showToast(result.notice);
  }

  return (
    <section className="settings-page content-section">
      <div className="page-title-row"><div><span className="eyebrow">Your account</span><h1>Settings</h1><p>Keep your profile, sizes, and account details up to date.</p></div></div>
      <div className="settings-grid">
        <aside className="settings-nav">
          {tabs.map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value}<span>→</span></button>)}
          <button className="danger-setting" onClick={logout}>Log out <span>↗</span></button>
        </aside>
        <form className="settings-panel" onSubmit={save}>
          <div className="settings-panel-head"><span className="eyebrow">Account details</span><h2>{tab}</h2><p>{tab === "Style & sizes" ? "We’ll highlight pieces that match your saved fit." : "Only share information you’re comfortable showing the community."}</p></div>
          {tab === "Edit profile" && (
            <>
              <div className="avatar-editor"><Avatar user={currentUser} size="lg" /><button type="button">Change photo</button><small>JPG or PNG · max 5 MB</small></div>
              <div className="form-grid">
                <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label>Username<input value={currentUser.username} readOnly /></label>
                <label>Email<input value={email} readOnly /></label>
                <label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                <label className="field-wide">Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Metro Manila" /></label>
                <label className="field-wide">Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Share what you look for on the rack..." /></label>
              </div>
            </>
          )}
          {tab === "Style & sizes" && (
            <div className="style-size-panel">
              <div className="size-grid">
                <label>Top size<select value={topSize} onChange={(event) => setTopSize(event.target.value)}><option>S</option><option>M</option><option>L</option><option>XL</option></select></label>
                <label>Bottom waist<select value={bottomSize} onChange={(event) => setBottomSize(event.target.value)}><option>27</option><option>28</option><option>29</option><option>30</option><option>32</option></select></label>
                <label>Shoe size<select value={shoeSize} onChange={(event) => setShoeSize(event.target.value)}><option>EU 38</option><option>EU 39</option><option>EU 40</option><option>EU 41</option></select></label>
              </div>
              <fieldset><legend>Styles you look for</legend><div className="chip-checks">{["Vintage", "Minimal", "Streetwear", "Y2K", "Workwear", "Romantic"].map((value) => <label key={value}><input type="checkbox" checked={styleTags.includes(value)} onChange={(event) => setStyleTags((current) => event.target.checked ? [...current, value] : current.filter((tag) => tag !== value))} />{value}</label>)}</div></fieldset>
            </div>
          )}
          {tab === "Change password" && (
            <div className="auth-managed-panel"><span>✣</span><div><h3>Sign-in security is managed by ChatGPT</h3><p>Use your ChatGPT account settings to update your password or security methods. OK-OK never stores your hosted password.</p><button className="managed-auth-link" type="button" onClick={() => window.location.assign("/signout-with-chatgpt?return_to=%2Flogin")}>Sign out securely →</button></div></div>
          )}
          {tab === "Policies" && (
            <div className="policy-list">{["Community guidelines", "Buyer protection", "Seller standards", "Privacy policy"].map((value) => <button type="button" key={value}><span>◇</span><strong>{value}</strong><em>Read →</em></button>)}</div>
          )}
          {tab === "Report a concern" && (
            <div className="single-form-column"><label>What happened?<select><option>Problem with a listing</option><option>Problem with a user</option><option>Payment or delivery issue</option></select></label><label>Details<textarea placeholder="Tell us enough to investigate..." /></label></div>
          )}
          {!["Policies", "Change password"].includes(tab) && <div className="settings-actions"><button type="button" className="text-link">Cancel</button><button className="button button--coral" type="submit">{tab === "Report a concern" ? "Submit report" : "Save changes"}</button></div>}
        </form>
      </div>
    </section>
  );
}

function SellPage(props: ScreenProps) {
  const { state, setState, currentUserId, go, showToast, syncAction } = props;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Jacket");
  const [details, setDetails] = useState("");
  const [condition, setCondition] = useState("Very good");
  const [size, setSize] = useState("M");
  const [mode, setMode] = useState<ListingMode>("msg");
  const [mine, setMine] = useState("500");
  const [steal, setSteal] = useState("650");
  const [grab, setGrab] = useState("800");
  const [startBid, setStartBid] = useState("500");
  const [increment, setIncrement] = useState("50");
  const [preview, setPreview] = useState(IMG.jacket);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<Array<File | null>>([
    null,
    null,
    null,
  ]);
  const [additionalPreviews, setAdditionalPreviews] = useState<string[]>([]);
  const additionalPreviewsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  useEffect(() => {
    additionalPreviewsRef.current = additionalPreviews;
  }, [additionalPreviews]);
  useEffect(() => {
    return () => {
      additionalPreviewsRef.current.forEach((image) => URL.revokeObjectURL(image));
    };
  }, []);
  if (!currentUserId) return <SignInGate go={go} title="Log in to start selling" />;
  const sellerId = currentUserId;

  function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setMainFile(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  function chooseAdditional(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAdditionalFiles((current) => current.map((value, row) => (row === index ? file : value)));
    setAdditionalPreviews((current) => {
      const next = [...current];
      if (next[index]) URL.revokeObjectURL(next[index]);
      next[index] = URL.createObjectURL(file);
      return next;
    });
  }

  async function uploadPhoto(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "That photo could not be uploaded.");
    }
    return payload.url;
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !details.trim()) {
      showToast("Add a title and a few item details first.");
      return;
    }
    if (mode === "msg" && !(Number(mine) < Number(steal) && Number(steal) < Number(grab))) {
      showToast("MSG prices should rise from Mine to Steal to Grab.");
      return;
    }
    let publishedImages = [preview];
    const selectedPhotos = [mainFile, ...additionalFiles].filter(
      (file): file is File => Boolean(file)
    );
    if (selectedPhotos.length) {
      try {
        publishedImages = await Promise.all(selectedPhotos.map(uploadPhoto));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Those photos could not be uploaded.");
        return;
      }
    }
    const timestamp = Date.now();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + timestamp;
    const newItem: Item = {
      id,
      title: title.trim(),
      category,
      description: details.trim(),
      condition,
      size,
      color: "Seller specified",
      sellerId,
      images: publishedImages,
      tags: ["new listing"],
    };
    const newListing: Listing = {
      id: "l-" + timestamp,
      itemId: id,
      mode,
      status: mode === "msg" ? "available" : "bidding",
      minePrice: mode === "msg" ? Number(mine) : undefined,
      stealPrice: mode === "msg" ? Number(steal) : undefined,
      grabPrice: mode === "msg" ? Number(grab) : undefined,
      startingBid: mode === "bid" ? Number(startBid) : undefined,
      bidIncrement: mode === "bid" ? Number(increment) : undefined,
      currentBid: mode === "bid" ? Number(startBid) : undefined,
      expiresAt: mode === "bid" ? timestamp + 24 * 60 * 60 * 1000 : undefined,
      engagedUserIds: [],
      revision: 1,
    };
    const previousIds = new Set(state.items.map((item) => item.id));
    const result = await syncAction("createListing", { item: newItem, listing: newListing });
    if (!result.ok) {
      showToast(result.notice);
      return;
    }
    const persistedItem = result.normalized?.state.items.find(
      (item) => !previousIds.has(item.id) && item.sellerId === currentUserId
    );
    if (!result.normalized) {
      setState((current) => ({
        ...current,
        items: [newItem, ...current.items],
        listings: [newListing, ...current.listings],
      }));
    }
    showToast(result.notice);
    go("/items/" + (persistedItem?.id || id));
  }

  return (
    <section className="sell-page content-section">
      <div className="page-title-row"><div><span className="eyebrow">Seller studio</span><h1>List a piece</h1><p>Good photos and honest details help the right buyer move fast.</p></div><button className="button button--outline" onClick={() => showToast("Draft saved on this device.")}>Save draft</button></div>
      <form className="listing-form" onSubmit={publish}>
        <section className="listing-images-panel">
          <div className="panel-number">01</div>
          <div><span className="eyebrow">Product images</span><h2>Show every good angle</h2><p>Use bright, natural light. Include tags, flaws, and texture.</p></div>
          <label className="main-uploader">
            <img src={preview} alt="Listing preview" />
            <span className="upload-overlay"><b>＋</b><strong>Choose main photo</strong><small>JPG or PNG · up to 8 MB</small></span>
            <input type="file" accept="image/*" onChange={choosePhoto} />
          </label>
          <div className="extra-uploaders">
            {[0, 1, 2].map((index) => (
              <label key={index}>
                {additionalPreviews[index] ? (
                  <img src={additionalPreviews[index]} alt={"Additional preview " + (index + 1)} />
                ) : (
                  <>
                    <span>＋</span>
                    <small>Add detail</small>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => chooseAdditional(index, event)}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="listing-details-panel">
          <div className="panel-number">02</div>
          <div><span className="eyebrow">Listing details</span><h2>Tell its story</h2></div>
          <div className="form-grid">
            <label className="field-wide">Item title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 90s cropped leather jacket" /></label>
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.slice(1).map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>Excellent</option><option>Very good</option><option>Good</option><option>Fair / visible wear</option></select></label>
            <label>Size<input value={size} onChange={(event) => setSize(event.target.value)} placeholder="M, 30, EU 40..." /></label>
            <label>Color<input placeholder="e.g. Chocolate brown" /></label>
            <label className="field-wide">Description<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share fit notes, measurements, fabric, and any signs of wear..." /></label>
          </div>
          <div className="pricing-section">
            <div><span className="eyebrow">Selling option</span><h2>Choose how buyers move</h2></div>
            <div className="pricing-toggle">
              <button type="button" className={mode === "msg" ? "active" : ""} onClick={() => setMode("msg")}><strong>Fix price · MSG</strong><small>Mine, Steal, or Grab tiers</small></button>
              <button type="button" className={mode === "bid" ? "active" : ""} onClick={() => setMode("bid")}><strong>Bidding</strong><small>Highest valid offer wins</small></button>
            </div>
            {mode === "msg" ? (
              <div className="price-field-grid">
                <label className="tier-field tier-field--mine"><span><b>Mine</b><small>Starts 24h clock</small></span><span className="money-input"><b>₱</b><input value={mine} onChange={(event) => setMine(event.target.value.replace(/\D/g, ""))} /></span></label>
                <label className="tier-field tier-field--steal"><span><b>Steal</b><small>Starts 10m sprint</small></span><span className="money-input"><b>₱</b><input value={steal} onChange={(event) => setSteal(event.target.value.replace(/\D/g, ""))} /></span></label>
                <label className="tier-field tier-field--grab"><span><b>Grab</b><small>Instant buyout</small></span><span className="money-input"><b>₱</b><input value={grab} onChange={(event) => setGrab(event.target.value.replace(/\D/g, ""))} /></span></label>
              </div>
            ) : (
              <div className="bid-price-fields">
                <label>Starting bid<span className="money-input"><b>₱</b><input value={startBid} onChange={(event) => setStartBid(event.target.value.replace(/\D/g, ""))} /></span></label>
                <label>Minimum increment<span className="money-input"><b>₱</b><input value={increment} onChange={(event) => setIncrement(event.target.value.replace(/\D/g, ""))} /></span></label>
                <label>Auction length<select defaultValue="24 hours"><option>12 hours</option><option>24 hours</option><option>3 days</option><option>7 days</option></select></label>
              </div>
            )}
          </div>
          <div className="publish-bar"><span>By publishing, you confirm this piece is authentic and accurately described.</span><button className="button button--coral" type="submit">Publish listing <b>↗</b></button></div>
        </section>
      </form>
    </section>
  );
}

function NotFound({ go }: { go: (path: string) => void }) {
  return (
    <section className="not-found">
      <span>404</span><h1>This rack is empty.</h1><p>The page may have moved, but there are plenty of finds waiting.</p>
      <button className="button button--brown" onClick={() => go("/")}>Back to the rack</button>
    </section>
  );
}
