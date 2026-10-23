import { randomBytes, randomInt } from 'node:crypto';

/**
 * Identifiers for new rows.
 *
 * The old scheme (`ORD-${Date.now()}`) had two problems: two requests in the same millisecond produced the
 * same primary key (one customer got a 500 and an unplaced order), and IDs could be enumerated by counting
 * milliseconds. 12 random bytes (96 bits) make a collision or a guess practically impossible, and encoded
 * as 20 base-32 characters they stay short enough for receipts and order cards. Existing rows keep their
 * old IDs.
 */
const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U

export const newId = (prefix: string): string => {
  const bytes = randomBytes(12);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ID_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ID_ALPHABET[(value << (5 - bits)) & 31];
  return `${prefix}-${out}`;
};

// No 0/O/1/I/L: tracking IDs are read aloud and typed by customers.
const TRACKING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `TRK-` plus three groups of four characters (about 59 bits), drawn from a cryptographic source. */
export const newTrackingId = (): string => {
  const group = () => Array.from({ length: 4 }, () => TRACKING_ALPHABET[randomInt(TRACKING_ALPHABET.length)]).join('');
  return `TRK-${group()}-${group()}-${group()}`;
};
