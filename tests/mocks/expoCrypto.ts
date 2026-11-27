// Stand-in for expo-crypto. Random bytes come from Node, so keys made in a test are real.
import { randomFillSync } from 'crypto';

export const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
  randomFillSync(array as unknown as Uint8Array);
  return array;
};
