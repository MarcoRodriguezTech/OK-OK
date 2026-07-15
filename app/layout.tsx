import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const candidateHost = forwardedHost.split(",")[0].trim();
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(candidateHost)
    ? candidateHost
    : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol =
    forwardedProtocol === "https"
      ? "https"
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const origin = protocol + "://" + host;
  const imageUrl = new URL("/og.png", origin).toString();
  const description =
    "Discover one-of-one thrift finds and make your move before somebody else does.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "OK-OK | The thrill of the rack, online.",
      template: "%s | OK-OK",
    },
    description,
    applicationName: "OK-OK",
    keywords: ["ukay-ukay", "thrift", "secondhand", "marketplace", "Philippines"],
    openGraph: {
      title: "OK-OK | The thrill of the rack, online.",
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1731, height: 909, alt: "OK-OK leather jacket social card" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "OK-OK | The thrill of the rack, online.",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
