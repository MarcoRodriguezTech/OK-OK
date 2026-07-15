import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasExpectedSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    );
  }
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
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

export async function POST(request: Request) {
  let authenticated: Awaited<ReturnType<typeof getChatGPTUser>>;
  try {
    authenticated = await getChatGPTUser();
  } catch {
    return Response.json({ error: "Sign-in could not be verified." }, { status: 503 });
  }
  if (!authenticated && !isLocalRequest(request)) {
    return Response.json({ error: "Sign in to upload listing photos." }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "The upload form is malformed." }, { status: 400 });
  }
  const upload = formData.get("file");
  if (!(upload instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (!SUPPORTED_IMAGES.has(upload.type)) {
    return Response.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }
  if (upload.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });
  }

  const signature = new Uint8Array(await upload.slice(0, 12).arrayBuffer());
  if (!hasExpectedSignature(upload.type, signature)) {
    return Response.json({ error: "The file contents do not match its image type." }, { status: 415 });
  }

  const extension =
    upload.type === "image/png"
      ? "png"
      : upload.type === "image/webp"
        ? "webp"
        : "jpg";
  const key = "listing-" + crypto.randomUUID() + "." + extension;
  try {
    await env.BUCKET.put(key, upload.stream(), {
      httpMetadata: {
        contentType: upload.type,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        uploadedBy: authenticated?.email || "local-demo",
      },
    });
  } catch {
    return Response.json({ error: "The image store is temporarily unavailable." }, { status: 503 });
  }
  return Response.json({ url: "/api/uploads/" + key }, { status: 201 });
}
