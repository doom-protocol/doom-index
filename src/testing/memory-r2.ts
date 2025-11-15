/**
 * In-memory R2 bucket implementation for tests and local scripts.
 * Not included in production builds.
 */
export type StoredValue = {
  content: ArrayBuffer | string;
  contentType?: string;
};

const extractContentType = (metadata?: R2PutOptions["httpMetadata"]): string | undefined => {
  if (!metadata) {
    return undefined;
  }

  if (metadata instanceof Headers) {
    return metadata.get("Content-Type") ?? undefined;
  }

  return metadata.contentType;
};

const cloneBuffer = (buffer: ArrayBuffer): ArrayBuffer => buffer.slice(0);

export function createTestR2Bucket(): {
  bucket: R2Bucket;
  store: Map<string, StoredValue>;
} {
  const store = new Map<string, StoredValue>();

  const bucket = {
    async put(key: string, value: ArrayBuffer | string, options?: R2PutOptions): Promise<void> {
      const content = value instanceof ArrayBuffer ? cloneBuffer(value) : value;
      const contentType = extractContentType(options?.httpMetadata);
      store.set(key, {
        content,
        contentType,
      });
    },

    async get(key: string): Promise<R2Object | null> {
      const entry = store.get(key);
      if (!entry) return null;

      const { content } = entry;
      const arrayBuffer =
        content instanceof ArrayBuffer ? cloneBuffer(content) : new TextEncoder().encode(content).buffer;

      return {
        key,
        version: "1",
        size: arrayBuffer.byteLength,
        etag: `"${key}"`,
        httpEtag: `"${key}"`,
        checksums: {},
        uploaded: new Date(),
        body: arrayBuffer,
        httpMetadata: entry.contentType ? { contentType: entry.contentType } : undefined,
        writeHttpMetadata: (headers: Headers) => {
          if (entry.contentType) {
            headers.set("Content-Type", entry.contentType);
          }
        },
        arrayBuffer: async () => arrayBuffer,
        text: async () => {
          if (typeof content === "string") {
            return content;
          }

          const decoder = new TextDecoder();
          return decoder.decode(content);
        },
      } as unknown as R2ObjectBody;
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },

    async list(options?: R2ListOptions): Promise<R2Objects> {
      const prefix = options?.prefix ?? "";
      const limit = options?.limit ?? 1000;
      const startAfter = options?.startAfter;
      const cursor = options?.cursor;

      let matchingKeys = Array.from(store.keys())
        .filter(key => key.startsWith(prefix))
        .sort();

      if (startAfter) {
        matchingKeys = matchingKeys.filter(key => key > startAfter);
      }

      if (cursor) {
        const cursorIndex = matchingKeys.indexOf(cursor);
        if (cursorIndex >= 0) {
          matchingKeys = matchingKeys.slice(cursorIndex + 1);
        }
      }

      const truncated = matchingKeys.length > limit;
      const resultKeys = matchingKeys.slice(0, limit);
      const nextCursor = truncated && resultKeys.length > 0 ? resultKeys[resultKeys.length - 1] : undefined;

      const objects: R2Object[] = resultKeys.map(key => {
        const entry = store.get(key);
        const size = entry?.content instanceof ArrayBuffer ? entry.content.byteLength : (entry?.content?.length ?? 0);
        const etag = `"${key}"`;
        return {
          key,
          version: "1",
          size,
          etag,
          httpEtag: etag,
          checksums: {},
          uploaded: new Date(),
          httpMetadata: entry?.contentType ? { contentType: entry.contentType } : undefined,
          storageClass: "STANDARD",
          writeHttpMetadata: (headers: Headers) => {
            if (entry?.contentType) {
              headers.set("Content-Type", entry.contentType);
            }
          },
        } as R2Object;
      });

      if (truncated && nextCursor) {
        return {
          objects,
          delimitedPrefixes: [],
          truncated: true,
          cursor: nextCursor,
        };
      }

      return {
        objects,
        delimitedPrefixes: [],
        truncated: false,
      };
    },
  } as unknown as R2Bucket;

  return { bucket, store };
}
