/** Small UI preferences kept in localStorage (wrapped — storage can be blocked). */
export function getPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('pp:' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function setPref<T>(key: string, value: T) {
  try {
    localStorage.setItem('pp:' + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
