/**
 * Tests for raw-storage-stream.js
 * US-3: Size Limit Handling
 */

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { hashStreamWithLimit } from './raw-storage-stream.js';

/** Create a readable stream from chunks */
function createReadableStream(chunks) {
  return Readable.from(chunks);
}

describe('hashStreamWithLimit', () => {
  it('should hash content under the limit and return buffer', async () => {
    const content = Buffer.from('hello world');
    const stream = createReadableStream([content]);

    const result = await hashStreamWithLimit(stream, 1024);

    expect(result.isOversize).toBe(false);
    expect(result.bytes).toBe(11);
    expect(result.buffer).not.toBeNull();
    expect(result.buffer.toString()).toBe('hello world');
    expect(result.contentHash).toHaveLength(64);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should hash content over the limit and return null buffer', async () => {
    const chunk1 = Buffer.alloc(1024, 'a');
    const chunk2 = Buffer.alloc(1024, 'b');
    const stream = createReadableStream([chunk1, chunk2]);

    const result = await hashStreamWithLimit(stream, 1500);

    expect(result.isOversize).toBe(true);
    expect(result.bytes).toBe(2048);
    expect(result.buffer).toBeNull();
    expect(result.contentHash).toHaveLength(64);
  });

  it('should compute same hash regardless of size limit', async () => {
    const content = Buffer.from('test content for hashing');

    const stream1 = createReadableStream([content]);
    const result1 = await hashStreamWithLimit(stream1, 1000);

    const stream2 = createReadableStream([content]);
    const result2 = await hashStreamWithLimit(stream2, 10);

    expect(result1.contentHash).toBe(result2.contentHash);
    expect(result1.isOversize).toBe(false);
    expect(result2.isOversize).toBe(true);
  });

  it('should handle empty stream', async () => {
    const stream = createReadableStream([]);

    const result = await hashStreamWithLimit(stream, 1024);

    expect(result.isOversize).toBe(false);
    expect(result.bytes).toBe(0);
    expect(result.buffer).not.toBeNull();
    expect(result.buffer.length).toBe(0);
  });

  it('should handle content exactly at limit', async () => {
    const content = Buffer.alloc(100, 'x');
    const stream = createReadableStream([content]);

    const result = await hashStreamWithLimit(stream, 100);

    expect(result.isOversize).toBe(false);
    expect(result.bytes).toBe(100);
    expect(result.buffer).not.toBeNull();
  });

  it('should handle content just over limit', async () => {
    const content = Buffer.alloc(101, 'x');
    const stream = createReadableStream([content]);

    const result = await hashStreamWithLimit(stream, 100);

    expect(result.isOversize).toBe(true);
    expect(result.bytes).toBe(101);
    expect(result.buffer).toBeNull();
  });

  it('should handle multiple chunks crossing limit', async () => {
    const chunk1 = Buffer.alloc(50, 'a');
    const chunk2 = Buffer.alloc(50, 'b');
    const chunk3 = Buffer.alloc(50, 'c');
    const stream = createReadableStream([chunk1, chunk2, chunk3]);

    const result = await hashStreamWithLimit(stream, 100);

    expect(result.isOversize).toBe(true);
    expect(result.bytes).toBe(150);
    expect(result.buffer).toBeNull();
  });
});
