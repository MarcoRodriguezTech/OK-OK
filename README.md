# OK-OK

OK-OK is a responsive marketplace prototype for Filipino ukay-ukay culture. It combines conventional bidding with a server-authoritative Mine / Steal / Grab buying flow.

> "The thrill of the rack, online."

## Design and wireframes

The original UI/UX flow is maintained in Canva: [open the complete OK-OK website wireframe](https://canva.link/izsvb3bn4142dve).

## Product surface

The app includes:

- Branded login and sign-up screens, plus hosted Sign in with ChatGPT.
- A global category/search header with notifications, inbox, cart, and profile menus.
- A featured home experience driven by the highest live item value.
- Browse and item-detail views for MSG and bidding listings.
- Live Mine, Steal, Grab, and bid actions with revision checks and server timestamps.
- Three cart sections: Secured / Locked, Active Battles, and Lost.
- Notification and chat experiences, including system win messages.
- Buyer and seller profile modes, purchase/sales history, preferred shops, and size preferences.
- Seller listing creation with MSG and bidding price branches.
- Mobile layouts for the app header, product grid, item detail, chat, cart, profiles, and forms.

## Architecture

The requested product is implemented as one Cloudflare Worker-compatible vinext application:

    app/
      api/market/route.ts       Read and mutate the live market
      [...slug]/page.tsx        Deep-link route surface
      layout.tsx                Metadata and social preview
      okok-app.tsx              Marketplace UI and client interactions
    db/
      schema.ts                 Drizzle schema
    drizzle/
      0000_ok_ok_market.sql     D1 migration
    lib/
      market-seed.ts            Idempotent demo schema/seed setup
      market-types.ts           Shared domain types
      server-market.ts          State machine, settlement, queries, notifications
    worker/
      index.ts                  Cloudflare Worker entry

Next-style file routing is used instead of adding a second React Router or Express runtime. D1 is the Sites-native relational store and R2 stores seller-uploaded photos; this replaces the PostgreSQL service proposed in the original brief while preserving the same domain model.

## Data model

The schema models users, items, listings, item state events, bids, transactions, notifications, conversations, conversation members, messages, cart entries, reports, and market metadata.

Money is stored as whole Philippine pesos. Listing revisions are used for optimistic concurrency. Listing expiry timestamps are stored by the server and returned with server time; the browser only renders the countdown.

## Commerce rules

- **Mine:** Only an available MSG listing can be mined. The server assigns the holder and starts a 24-hour expiry.
- **Steal:** A different user can steal an active mined/stolen listing. The holder changes and the server starts a new 10-minute sprint. Engaged users are notified.
- **Grab:** An unsold MSG listing is immediately sold and locked at the Grab price.
- **Bid:** A bid must meet current bid plus increment; when there is no bid, it must meet starting price plus increment.
- **Settle:** Expired MSG and bidding listings are settled before reads and mutations. The winner receives a secured cart entry, transaction, notification, and system chat message.

All mutations are validated on the server and guarded by the listing revision supplied by the client.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

    npm install
    npm run dev

Open the local URL printed by vinext. The app creates and seeds its local D1 database on the first market API request.

Useful commands:

    npm run build
    npm test
    npm run lint
    npm run db:generate

## Demo data

The server seeds five community members, eight items, MSG and bidding listings in available/active/sold states, bid history, events, notifications, cart entries, reports, transactions, and conversations.

The branded username/password form is a demo interaction for local exploration; it does not claim production password security. Hosted identity is provided by **Sign in with ChatGPT**. Hosted write requests derive the actor from authenticated headers rather than client JSON, and private notifications, conversations, carts, reports, contact fields, and transactions are scoped to that viewer.

## Implemented vs. staged

Implemented:

- Complete responsive page flow and navigation.
- Persistent D1 schema, migration, runtime initialization, and seed data.
- Durable main and additional listing-photo uploads backed by R2.
- Server-authoritative MSG/bidding state machine, expiry settlement, concurrency checks, notifications, cart changes, and system chat creation.
- Hosted identity enforcement and viewer-scoped private marketplace data.
- Persisted profile details, fit preferences, and style tags.
- Polling-friendly API response with authoritative server time.
- Project-specific Open Graph image and metadata.

Staged for a production hardening phase:

- Image cropping, reordering, and seller-side listing editing can be added on top of the durable upload flow.
- Realtime updates use API refresh/polling semantics. Durable Objects or another broadcast layer can add instant WebSocket fan-out.
- Payment, shipping-provider, moderation-queue, password recovery, and public app-owned credential auth integrations are represented by product UI, not external services.
- Exact unattended settlement at the instant nobody is viewing would require a scheduled trigger or Durable Object alarm. Every read and write currently settles expired listings idempotently.
