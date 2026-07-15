interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<Array<D1Result<T>>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  cacheExpiry?: Date;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string | null,
    options?: R2PutOptions,
  ): Promise<R2Object | null>;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
  }
}

declare module "cloudflare:workers" {
  const env: Cloudflare.Env;
  export { env };
}
