// In-memory stand-in for expo-secure-store. __dump() lets a test see exactly what was saved.
let store = new Map<string, string>();

export const getItemAsync = jest.fn(async (key: string) => store.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  store.delete(key);
});
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
export const __reset = () => {
  store = new Map();
};
export const __dump = () => Object.fromEntries(store);
