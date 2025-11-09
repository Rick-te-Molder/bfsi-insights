import { describe, it, expect } from 'vitest';
import { parseResources } from '../schemas/resource-schema.mjs';

describe('resource schema', () => {
  it('accepts valid resources', () => {
    const data = [
      {
        slug: 'abc',
        title: 'Title',
        url: 'https://example.com',
        topic: 'technology-and-data-ai',
        content_type: ['report'],
      },
    ];
    const out = parseResources(data);
    expect(out.length).toBe(1);
    expect(Array.isArray(out[0].topic)).toBe(true);
    expect(Array.isArray(out[0].content_type)).toBe(true);
  });

  it('rejects invalid resources', () => {
    const bad = [{ slug: '', title: '' }];
    expect(() => parseResources(bad)).toThrowError();
  });
});
