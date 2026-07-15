import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  if (!/^[a-z0-9.-]+$/i.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!SUPPORTED_IMAGES.has(headers.get("content-type") || "")) {
    return new Response("Not found", { status: 404 });
  }
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  return new Response(object.body, { headers });
}
