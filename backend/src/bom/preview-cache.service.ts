import { Injectable } from '@nestjs/common';
import { CachedPreview } from './bom.types';

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PreviewCacheService {
  private store = new Map<string, CachedPreview>();

  set(token: string, payload: Omit<CachedPreview, 'expiresAt'>) {
    this.store.set(token, { ...payload, expiresAt: Date.now() + TTL_MS });
  }

  get(token: string): CachedPreview | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(token);
      return null;
    }
    return entry;
  }

  delete(token: string) {
    this.store.delete(token);
  }

  sweep() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
