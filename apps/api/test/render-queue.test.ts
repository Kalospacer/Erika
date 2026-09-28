import { describe, expect, it } from "vitest";
import { QueueOverflowError, RenderQueue } from "../src/render-cache.js";

describe("RenderQueue", () => {
  it("limits concurrency", async () => {
    const q = new RenderQueue(2, 10);
    let running = 0;
    let peak = 0;
    const task = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
    };
    await Promise.all(Array.from({ length: 6 }, () => q.run(task)));
    expect(peak).toBe(2);
  });

  it("rejects with QueueOverflowError when the waiting list is full", async () => {
    const q = new RenderQueue(1, 1);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const blocker = q.run(() => gate.then(() => "done"));
    const slow = Array.from({ length: 1 }, () => q.run(async () => "queued")); // fills the queue
    const overflow = q.run(async () => "never");
    await expect(overflow).rejects.toBeInstanceOf(QueueOverflowError);
    release();
    await expect(blocker).resolves.toBe("done");
    await Promise.all(slow);
  });
});
