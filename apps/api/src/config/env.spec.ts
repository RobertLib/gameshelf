import { parseTrustProxy } from './env';

/**
 * `TRUST_PROXY` decides whether request limits count real visitors or lump
 * everyone together as a single proxy address. Both wrong settings are silent,
 * which is why this has a test of its own.
 */
describe('parseTrustProxy', () => {
  it('trusts nobody when unset', () => {
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
  });

  it('understands the off values', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
    expect(parseTrustProxy('OFF')).toBe(false);
  });

  it('treats a number as the count of proxies between client and application', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('passes Express keywords and ranges through unchanged', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy(' 10.0.0.0/8 ')).toBe('10.0.0.0/8');
  });

  /** Trusting the whole chain is possible, but it has to be a deliberate choice. */
  it('supports "trust everyone" too', () => {
    expect(parseTrustProxy('true')).toBe(true);
  });
});
