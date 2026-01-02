import { describe, it, expect, vi } from 'vitest';

const { mockCryptoRandomInt } = vi.hoisted(() => ({
  mockCryptoRandomInt: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomInt: mockCryptoRandomInt,
}));

import { randomInt } from '../../src/lib/random.js';

describe('lib/random', () => {
  it('delegates to node:crypto randomInt', () => {
    mockCryptoRandomInt.mockReturnValue(7);

    const result = randomInt(1, 10);

    expect(result).toBe(7);
    expect(mockCryptoRandomInt).toHaveBeenCalledWith(1, 10);
  });
});
