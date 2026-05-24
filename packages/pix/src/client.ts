import axios, { AxiosError, AxiosInstance } from 'axios';
import { VERSION } from './version.js';

export interface PayzuError {
  statusCode: number;
  error: string;
  message: string;
  errorCode?: string;
  requestId?: string;
}

export interface HttpConfig {
  token: string;
  baseUrl: string;
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_METHODS = new Set(['get', 'head', 'options']);
const MAX_RETRIES = 3;

function backoffMs(attempt: number): number {
  const base = 250 * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return Math.min(base + jitter, 5000);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createHttp({ token, baseUrl }: HttpConfig): AxiosInstance {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `payzu-mcp-pix/${VERSION}`,
    },
  });

  http.interceptors.response.use(undefined, async (err: AxiosError<PayzuError>) => {
    const cfg = err.config as (typeof err.config & { __retry?: number }) | undefined;
    if (!cfg) throw err;
    const status = err.response?.status ?? 0;
    const method = (cfg.method ?? 'get').toLowerCase();
    cfg.__retry = (cfg.__retry ?? 0) + 1;
    if (cfg.__retry > MAX_RETRIES || !RETRY_STATUSES.has(status) || !RETRY_METHODS.has(method)) {
      throw err;
    }
    process.stderr.write(`[payzu-mcp-pix] retry ${cfg.__retry}/${MAX_RETRIES} ${cfg.method} ${cfg.url} (status=${status})\n`);
    await sleep(backoffMs(cfg.__retry - 1));
    return http.request(cfg);
  });

  return http;
}

export function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as PayzuError | undefined;
    const status = err.response?.status ?? 'network';
    const message = data?.message ?? err.message;
    const details = [
      data?.errorCode ? `errorCode=${data.errorCode}` : '',
      data?.requestId ? `requestId=${data.requestId}` : '',
    ].filter(Boolean).join(', ');
    return details ? `[${status}] ${message} (${details})` : `[${status}] ${message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
