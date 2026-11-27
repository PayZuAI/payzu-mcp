import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { formatError } from './client.js';

function stripHeavy(value: unknown, fields: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => stripHeavy(v, fields));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !fields.includes(k))
        .map(([k, v]) => [k, stripHeavy(v, fields)]),
    );
  }
  return value;
}

export function ok(data: unknown, stripFields: readonly string[] = ['qrCodeBase64']) {
  const cleaned = stripFields.length ? stripHeavy(data, stripFields) : data;
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned, null, 2),
      },
    ],
  };
}

export function okImage(data: ArrayBuffer, mimeType: string) {
  return {
    content: [
      {
        type: 'image' as const,
        data: Buffer.from(data).toString('base64'),
        mimeType,
      },
    ],
  };
}

export function toQuery(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]),
  );
}

export function fail(err: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: formatError(err),
      },
    ],
  };
}

export const docBase = 'https://docs.payzu.com.br/api';

export const SECRET_ONCE = 'O segredo aparece só nesta resposta; não existe rota para lê-lo de novo.';

export const READ_ONLY: ToolAnnotations = { readOnlyHint: true };

export const ADDITIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false };

export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };
