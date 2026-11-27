// Stand-in for expo-web-browser. A test sets what the sign-in page returns with __set(), and reads the pages that were opened with __calls().
export type AuthResult = { type: 'success'; url: string } | { type: 'cancel' } | { type: 'dismiss' };

let calls: { url: string; redirect: string }[] = [];

// result may be a function of the opened page, so a test can answer with a redirect that carries that page's `state`.
let answer: AuthResult | ((url: string) => AuthResult) = { type: 'cancel' };

export const openAuthSessionAsync = jest.fn(async (url: string, redirect: string) => {
  calls.push({ url, redirect });
  return typeof answer === 'function' ? answer(url) : answer;
});
export const __set = (next: AuthResult | ((url: string) => AuthResult)) => {
  answer = next;
};
export const __calls = () => calls;
export const __reset = () => {
  answer = { type: 'cancel' };
  calls = [];
  openAuthSessionAsync.mockClear();
};
