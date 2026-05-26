// Guarded localStorage with in-memory fallback so the app never crashes in
// sandboxed iframes or environments where storage is blocked.

const mem = new Map<string, string>();

let backend: "local" | "memory" = "memory";

(function detect() {
  try {
    if (typeof window === "undefined") return;
    const probe = "__cg_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    backend = "local";
  } catch {
    backend = "memory";
  }
})();

export function storageBackend(): "local" | "memory" {
  return backend;
}

export function getItem(key: string): string | null {
  try {
    if (backend === "local") return window.localStorage.getItem(key);
  } catch {
    backend = "memory";
  }
  return mem.has(key) ? mem.get(key)! : null;
}

export function setItem(key: string, value: string): void {
  try {
    if (backend === "local") {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    backend = "memory";
  }
  mem.set(key, value);
}

export function removeItem(key: string): void {
  try {
    if (backend === "local") {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    backend = "memory";
  }
  mem.delete(key);
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    setItem(key, JSON.stringify(value));
  } catch {
    /* swallow */
  }
}
