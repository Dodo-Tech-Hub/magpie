import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { NobleKey, runtimeImplementation } from '@/auth/blueskyKey';

const b64urlToBytes = (text: string) => new Uint8Array(Buffer.from(text, 'base64url'));
const json = (text: string) => JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));

describe('the sign-in key', () => {
  it('makes an ES256 key with a public part that can be shared and a private part that cannot', async () => {
    const key = await NobleKey.generate(['ES256']);
    expect(key.isPrivate).toBe(true);
    expect(key.publicJwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect((key.publicJwk as Record<string, unknown>).d).toBeUndefined();
    expect(key.algorithms).toContain('ES256');
    expect(key.kid).toBeTruthy();
  });

  it('makes a different key each time', async () => {
    const a = await NobleKey.generate(['ES256']);
    const b = await NobleKey.generate(['ES256']);
    expect(a.privateJwk).not.toEqual(b.privateJwk);
  });

  it('refuses an algorithm it cannot make', async () => {
    await expect(NobleKey.generate(['RS256'])).rejects.toThrow(TypeError);
  });

  it('signs a token that the public part verifies and that carries the header and payload as given', async () => {
    const key = await NobleKey.generate(['ES256']);
    const jwt = await key.createJwt({ alg: 'ES256', typ: 'dpop+jwt' }, { htm: 'POST', htu: 'https://x.test/token', iat: 1 });
    const [head, body, sig] = jwt.split('.');
    expect(json(head)).toEqual({ alg: 'ES256', typ: 'dpop+jwt' });
    expect(json(body)).toEqual({ htm: 'POST', htu: 'https://x.test/token', iat: 1 });
    // Test-only check with the library's own verify: the signature is over "head.body" and is 64 bytes.
    const jwk = key.publicJwk as { x: string; y: string };
    const pub = new Uint8Array([4, ...b64urlToBytes(jwk.x), ...b64urlToBytes(jwk.y)]);
    const signature = b64urlToBytes(sig);
    expect(signature).toHaveLength(64);
    expect(p256.verify(signature, new TextEncoder().encode(`${head}.${body}`), pub)).toBe(true);
    // A changed payload does not verify.
    expect(p256.verify(signature, new TextEncoder().encode(`${head}.${body}x`), pub)).toBe(false);
  });

  it('does not verify tokens, which a public app never needs', async () => {
    const key = await NobleKey.generate(['ES256']);
    await expect(key.verifyJwt('a.b.c' as never)).rejects.toThrow();
  });
});

describe('the runtime for the sign-in client', () => {
  it('makes keys, random bytes of the length asked, and hashes', async () => {
    const key = await runtimeImplementation.createKey(['ES256']);
    expect(key.isPrivate).toBe(true);
    const bytes = await runtimeImplementation.getRandomValues(32);
    expect(bytes).toHaveLength(32);
    expect(bytes.some((b) => b !== 0)).toBe(true);
    expect(await runtimeImplementation.getRandomValues(32)).not.toEqual(bytes);
    const hash = await runtimeImplementation.digest(new TextEncoder().encode('abc'), { name: 'sha256' });
    expect(Buffer.from(hash).toString('hex')).toBe(Buffer.from(sha256(new TextEncoder().encode('abc'))).toString('hex'));
    expect(Buffer.from(hash).toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
