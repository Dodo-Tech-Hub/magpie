import 'core-js/proposals/explicit-resource-management';
import 'react-native-url-polyfill/auto';
import { Key, type RuntimeImplementation } from '@atproto/oauth-client';
import { p256 } from '@noble/curves/nist.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

// The keys and hashes the Bluesky sign-in needs (research R2). Hermes has no WebCrypto, so the key is made
// with @noble/curves from random bytes that expo-crypto takes from the phone. The two imports above are the
// two polyfills Bluesky's own Expo client loads: the sign-in client needs `Symbol.dispose` and URL search params.

// The token types of the sign-in client, taken from the class so no second package is imported.
type JwtHeader = Parameters<Key['createJwt']>[0];
type JwtPayload = Parameters<Key['createJwt']>[1];
type SignedJwt = Awaited<ReturnType<Key['createJwt']>>;

const utf8 = (text: string) => new TextEncoder().encode(text);

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomBytes = (length: number) => Crypto.getRandomValues(new Uint8Array(length));

// An ES256 key. The private part never leaves the phone: the sign-in server only ever sees the public part.
export class NobleKey extends Key {
  // Signs the way ES256 asks: SHA-256 of "header.payload", as a raw 64-byte signature.
  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    const input = `${base64url(utf8(JSON.stringify(header)))}.${base64url(utf8(JSON.stringify(payload)))}`;
    const d = base64urlToBytes((this.jwk as { d?: string }).d ?? '');
    return `${input}.${base64url(p256.sign(utf8(input), d))}` as SignedJwt;
  }

  // A public app only signs, so there is nothing to verify.
  async verifyJwt(_token?: SignedJwt): Promise<never> {
    throw new Error('A public app does not verify tokens');
  }

  static async generate(algs: string[]): Promise<NobleKey> {
    if (!algs.includes('ES256')) throw new TypeError(`No supported algorithm found in: ${algs.join(', ')}`);
    const d = p256.utils.randomSecretKey(randomBytes(p256.lengths.seed ?? 48));
    const pub = p256.getPublicKey(d, false);
    const x = base64url(pub.slice(1, 33));
    const y = base64url(pub.slice(33, 65));
    return new NobleKey({
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: base64url(d),
      // A public key must have an ID. This one is a hash of the key, so the same key always has the same ID.
      kid: base64url(sha256(utf8(`${x}.${y}`))),
      alg: 'ES256',
      key_ops: ['sign'],
    } as never);
  }
}

function base64urlToBytes(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const HASHES = { sha256, sha384, sha512 };

export const runtimeImplementation: RuntimeImplementation = {
  createKey: (algs) => NobleKey.generate(algs),
  getRandomValues: randomBytes,
  digest: (data, alg) => HASHES[alg.name](data),
};
