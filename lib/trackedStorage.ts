const LS_KEY = 'nextrole_tracked_ids';

export function getTrackedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function writeTrackedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function addTrackedId(jobId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getTrackedIds();
    ids.add(jobId);
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function removeTrackedId(jobId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getTrackedIds();
    ids.delete(jobId);
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
}
