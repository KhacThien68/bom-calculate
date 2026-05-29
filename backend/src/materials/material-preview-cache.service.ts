import { Injectable } from '@nestjs/common';
import { CachedMaterialPreview } from './materials.types';

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class MaterialPreviewCacheService {
  private store = new Map<string, CachedMaterialPreview>();

  set(token: string, payload: Omit<CachedMaterialPreview, 'expiresAt'>) {
    this.store.set(token, { ...payload, expiresAt: Date.now() + TTL_MS });
  }

  get(token: string): CachedMaterialPreview | null {
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
}
