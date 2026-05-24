import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from './env.js';

export interface PayzuError {
  statusCode: number;
  error: string;
  message: string;
  requestId?: string;
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

function backoffMs(attempt: number): number {
  const base = 250 * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return Math.min(base + jitter, 5000);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const http: AxiosInstance = axios.create({
  baseURL: env.PAYZU_API_URL,
  timeout: 30_000,
  headers: {
    Authorization: `Bearer ${env.PAYZU_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': `payzu-mcp-pix/0.1.0`,
  },
});

http.interceptors.response.use(undefined, async (err: AxiosError<PayzuError>) => {
  const cfg = err.config as (typeof err.config & { __retry?: number }) | undefined;
  if (!cfg) throw err;
  const status = err.response?.status ?? 0;
  cfg.__retry = (cfg.__retry ?? 0) + 1;
  if (cfg.__retry > MAX_RETRIES || !RETRY_STATUSES.has(status)) {
    throw err;
  }
  process.stderr.write(`[payzu-mcp-pix] retry ${cfg.__retry}/${MAX_RETRIES} ${cfg.method} ${cfg.url} (status=${status})\n`);
  await sleep(backoffMs(cfg.__retry - 1));
  return http.request(cfg);
});

export function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as PayzuError | undefined;
    const status = err.response?.status ?? 'network';
    const message = data?.message ?? err.message;
    const requestId = data?.requestId ? ` (requestId=${data.requestId})` : '';
    return `[${status}] ${message}${requestId}`;
  }
  return err instanceof Error ? err.message : String(err);
}
