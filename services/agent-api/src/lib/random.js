import { randomInt as cryptoRandomInt } from 'node:crypto';

/**
 * Cryptographically secure random integer in range [min, max)
 * Use this instead of Math.random() in production code.
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer in range [min, max)
 */
export function randomInt(min, max) {
  return cryptoRandomInt(min, max);
}
