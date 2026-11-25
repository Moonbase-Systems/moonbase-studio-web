/**
 * One decoded buffer per asset signature. A failed decode is dropped so the next play can try again.
 * Callers keep a key while a project sound points at it or a voice is still using it.
 */
export class OverlayBufferCache<T> {
  private readonly entries = new Map<string, Promise<T>>();

  constructor(private readonly decode: (url: string) => Promise<T>) {}

  load(cacheKey: string, url: string): Promise<T> {
    const existing = this.entries.get(cacheKey);
    if (existing) {
      return existing;
    }
    const pending = this.decode(url);
    this.entries.set(cacheKey, pending);
    pending.catch(() => {
      if (this.entries.get(cacheKey) === pending) {
        this.entries.delete(cacheKey);
      }
    });
    return pending;
  }

  retain(keep: ReadonlySet<string>): void {
    for (const key of this.entries.keys()) {
      if (!keep.has(key)) {
        this.entries.delete(key);
      }
    }
  }
}
