import type { Driver } from '@/platforms/driver';

// Plug a fake platform behavior into a real driver for one test. restore() puts the driver back exactly as it was,
// including removing the keys the test added.
export function patchDriver(driver: Driver) {
  const original = { ...driver };
  return {
    original,
    apply: (extra: Record<string, unknown>) => Object.assign(driver, extra),
    restore: () => {
      for (const key of Object.keys(driver)) if (!(key in original)) delete (driver as Record<string, unknown>)[key];
      Object.assign(driver, original);
    },
  };
}
