// No-op outside development. Never pass tokens, emails, or channel lists here.
export function log(message: string): void {
  if (__DEV__) console.log(message);
}
