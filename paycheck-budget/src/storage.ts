/**
 * storage.ts
 *
 * Drop-in replacement for Claude's window.storage API.
 * Uses standard localStorage so the app works anywhere.
 *
 * Usage — replace every window.storage call with these:
 *
 *   await storage.get("pb:bills")   →  { value: "..." } | null
 *   await storage.set("pb:bills", data)
 */

interface StorageResult {
  value: string;
}

export const storage = {
  get: async (key: string): Promise<StorageResult | null> => {
    try {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch {
      return null;
    }
  },

  set: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn(`Failed to save ${key} to localStorage`);
    }
  },

  delete: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
    } catch { /* silent */ }
  },
};
