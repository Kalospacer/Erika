/** Byte-bounded LRU for rendered images + single-flight render dedup. */

import { createHash } from "node:crypto";

export function etagOf(bytes: Buffer): string {
  return `"${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}"`;
}

export function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

interface Entry {
  bytes: Buffer;
  etag: string;
}

export class RenderCache {
  private map = new Map<string, Entry>();
  private totalBytes = 0;

  constructor(private maxBytes: number) {}

  get(key: string): Entry | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    // LRU touch
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, bytes: Buffer): Entry {
    if (bytes.length > this.maxBytes) {
      // single image larger than the whole cache: return etag without storing
      return { bytes, etag: etagOf(bytes) };
    }
    const prev = this.map.get(key);
    if (prev) {
      this.totalBytes -= prev.bytes.length;
      this.map.delete(key);
    }
    const entry = { bytes, etag: etagOf(bytes) };
    this.map.set(key, entry);
    this.totalBytes += bytes.length;
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.totalBytes -= this.map.get(oldest)!.bytes.length;
      this.map.delete(oldest);
    }
    return entry;
  }

  get sizeBytes(): number {
    return this.totalBytes;
  }

  get count(): number {
    return this.map.size;
  }
}

/** Merge concurrent async tasks with the same key (single-flight). */
export class SingleFlight<T> {
  private inflight = new Map<string, Promise<T>>();

  run(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = task().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}

export class QueueOverflowError extends Error {
  constructor(public maxQueue: number) {
    super(`render queue full (${maxQueue} waiting)`);
    this.name = "QueueOverflowError";
  }
}

/** Bounded render queue: fixed concurrency + max waiting tasks. Protects
 * process memory (decode/draw/encode) independently of the byte-bounded LRU
 * and of any reverse-proxy IP rate limiting (design doc 10.1). */
export class RenderQueue {
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(
    public readonly concurrency: number,
    public readonly maxQueue: number,
  ) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.waiting.length >= this.maxQueue) {
        return Promise.reject(new QueueOverflowError(this.maxQueue));
      }
      return new Promise<T>((resolve, reject) => {
        this.waiting.push(() => {
          this.active++;
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.pump();
            });
        });
      });
    }
    this.active++;
    return task().finally(() => {
      this.active--;
      this.pump();
    });
  }

  private pump(): void {
    const next = this.waiting.shift();
    if (next) next();
  }

  get depth(): number {
    return this.active + this.waiting.length;
  }
}
