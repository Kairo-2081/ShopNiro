// The session cookie is HttpOnly, so the page cannot tell whether a visitor is signed in until the sign-in check
// answers, and until then it has to guess which screen to draw. Guessing the landing page costs a returning customer
// the landing page's render (including the globe) before the storefront they came for. This remembers that the last
// check succeeded, in the browser only, so the next visit can start on the storefront instead.
//
// It is a hint, not a credential: it holds a timestamp and nothing that identifies anyone, the server still decides
// who is signed in, and a wrong guess is corrected as soon as the check answers.
export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SIGNED_IN_HINT_KEY = 'shopniro_signed_in_hint';
// Sessions last one hour, so a hint older than that is almost certainly pointing at an expired session.
export const SIGNED_IN_HINT_MAX_AGE_MS = 60 * 60 * 1000;

// Storage can be missing or throw (private windows, blocked site data), and the page has to work without it.
const browserStorage = (): HintStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function hasSignedInHint(now: number = Date.now(), storage: HintStorage | null = browserStorage()): boolean {
  try {
    const raw = storage?.getItem(SIGNED_IN_HINT_KEY);
    if (!raw) return false;
    const confirmedAt = Number(raw);
    return Number.isFinite(confirmedAt) && confirmedAt <= now && now - confirmedAt < SIGNED_IN_HINT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function rememberSignedIn(now: number = Date.now(), storage: HintStorage | null = browserStorage()): void {
  try {
    storage?.setItem(SIGNED_IN_HINT_KEY, String(now));
  } catch {
    // No storage: the next visit starts on the landing page, exactly as it did before the hint existed.
  }
}

export function forgetSignedIn(storage: HintStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(SIGNED_IN_HINT_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
