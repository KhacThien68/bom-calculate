import { isAxiosError } from 'axios';

export function getApiErrorStatus(e: unknown): number | undefined {
  return isAxiosError(e) ? e.response?.status : undefined;
}

export function getApiErrorMessage(e: unknown): string | undefined {
  if (!isAxiosError(e)) return undefined;
  const data = e.response?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return undefined;
}
