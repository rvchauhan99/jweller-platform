import { storage } from "@/src/utils/storage";

// Anonymous per-device identity used to scope guest SIP plans and reservations
// on the backend (no auth this pass). Persisted so it survives app restarts.
const GUEST_KEY = "guest_id";
let cached: string | null = null;

function uuid(): string {
  return "gxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getGuestId(): Promise<string> {
  if (cached) return cached;
  const existing = await storage.getItem<string>(GUEST_KEY, "");
  if (existing) {
    cached = existing;
    return existing;
  }
  const id = uuid();
  await storage.setItem(GUEST_KEY, id);
  cached = id;
  return id;
}
