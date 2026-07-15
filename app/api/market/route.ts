import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { MarketActionRequest } from "@/lib/market-types";
import {
  getMarketResponse,
  marketErrorMessage,
  marketErrorStatus,
  resolvePlatformViewer,
  runMarketAction,
} from "@/lib/server-market";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isOptionalText(value: unknown, max = 2_000) {
  return value === undefined || (typeof value === "string" && value.length <= max);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isOptionalPositiveNumber(value: unknown) {
  return value === undefined || isPositiveNumber(value);
}

function validActor(payload: JsonObject) {
  return payload.actorId === undefined || isText(payload.actorId, 100);
}

function isMarketAction(value: unknown): value is MarketActionRequest {
  if (!isObject(value) || !isText(value.action, 32) || !validActor(value)) return false;
  const revisionValid =
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision >= 0;

  switch (value.action) {
    case "mine":
    case "steal":
    case "grab":
      return isText(value.listingId, 100) && revisionValid;
    case "bid":
      return isText(value.listingId, 100) && revisionValid && isPositiveNumber(value.amount);
    case "settle":
      return value.listingId === undefined || isText(value.listingId, 100);
    case "createUser":
      return (
        isText(value.username, 60) &&
        isText(value.displayName, 120) &&
        isText(value.email, 254) &&
        isText(value.phone, 40)
      );
    case "updateProfile":
      return (
        isText(value.displayName, 120) &&
        typeof value.phone === "string" &&
        value.phone.length <= 40 &&
        isOptionalText(value.bio, 1_000) &&
        isOptionalText(value.location, 160) &&
        isOptionalText(value.preferredTopSize, 40) &&
        isOptionalText(value.preferredBottomSize, 40) &&
        isOptionalText(value.preferredShoeSize, 40) &&
        (value.styleTags === undefined ||
          (Array.isArray(value.styleTags) &&
            value.styleTags.length <= 12 &&
            value.styleTags.every((tag) => isText(tag, 40))))
      );
    case "sendMessage":
      return (
        isText(value.body, 2_000) &&
        (isText(value.conversationId, 100) || isText(value.recipientId, 100)) &&
        (value.conversationId === undefined || isText(value.conversationId, 100)) &&
        (value.recipientId === undefined || isText(value.recipientId, 100)) &&
        (value.listingId === undefined || isText(value.listingId, 100))
      );
    case "createListing": {
      const categoryValid = ["Caps", "Jackets", "Shirts", "Pants", "Shorts", "Shoes"].includes(
        String(value.category),
      );
      const imagesValid =
        value.images === undefined ||
        (Array.isArray(value.images) &&
          value.images.length <= 4 &&
          value.images.every((image) => isText(image, 2_048)));
      const common =
        isText(value.title, 140) &&
        isText(value.description, 4_000) &&
        categoryValid &&
        isOptionalText(value.brand, 100) &&
        isOptionalText(value.condition, 80) &&
        isOptionalText(value.size, 80) &&
        isOptionalText(value.imageUrl, 2_048) &&
        imagesValid &&
        isOptionalPositiveNumber(value.durationHours);
      if (!common) return false;
      if (value.mode === "msg") {
        return (
          isPositiveNumber(value.minePrice) &&
          isPositiveNumber(value.stealPrice) &&
          isPositiveNumber(value.grabPrice)
        );
      }
      return (
        value.mode === "bidding" &&
        isPositiveNumber(value.startingBid) &&
        isPositiveNumber(value.bidIncrement)
      );
    }
    case "report":
      return (
        isText(value.listingId, 100) &&
        isText(value.reason, 160) &&
        isOptionalText(value.details, 2_000)
      );
    default:
      return false;
  }
}

function badRequest(notice: string) {
  return Response.json(
    { state: null, serverNow: new Date().toISOString(), notice },
    { status: 400, headers: noStoreHeaders },
  );
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

async function viewerFor(request: Request): Promise<string | null | undefined> {
  const authenticated = await getChatGPTUser();
  if (authenticated) {
    return resolvePlatformViewer(
      authenticated.email,
      authenticated.fullName || authenticated.displayName,
    );
  }
  return isLocalRequest(request) ? undefined : null;
}

export async function GET(request: Request) {
  let viewerId: string | null | undefined = isLocalRequest(request)
    ? undefined
    : null;
  try {
    viewerId = await viewerFor(request);
    return Response.json(await getMarketResponse(undefined, viewerId), {
      headers: noStoreHeaders,
    });
  } catch (error) {
    return Response.json(
      {
        state: null,
        serverNow: new Date().toISOString(),
        notice: marketErrorMessage(error),
      },
      { status: marketErrorStatus(error), headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  let viewerId: string | null | undefined = isLocalRequest(request)
    ? undefined
    : null;
  try {
    viewerId = await viewerFor(request);
    let unknownPayload: unknown;
    try {
      unknownPayload = await request.json();
    } catch {
      return badRequest("The request body must be valid JSON.");
    }
    if (!isMarketAction(unknownPayload)) {
      return badRequest("The marketplace action is missing or has invalid fields.");
    }
    const payload = unknownPayload;
    if (viewerId === null) {
      return Response.json(
        await getMarketResponse("Sign in to make a marketplace move.", null),
        { status: 401, headers: noStoreHeaders },
      );
    }
    if (viewerId && payload.action === "createUser") {
      return Response.json(
        await getMarketResponse(
          "Your hosted OK-OK identity is managed by Sign in with ChatGPT.",
          viewerId,
        ),
        { status: 409, headers: noStoreHeaders },
      );
    }
    return Response.json(
      await runMarketAction(payload, viewerId || undefined),
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const notice = marketErrorMessage(error);
    try {
      return Response.json(await getMarketResponse(notice, viewerId), {
        status: marketErrorStatus(error),
        headers: noStoreHeaders,
      });
    } catch {
      return Response.json(
        { state: null, serverNow: new Date().toISOString(), notice },
        { status: marketErrorStatus(error), headers: noStoreHeaders },
      );
    }
  }
}
