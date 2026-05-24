import { formatError } from './client.js';

export function ok(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
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

export const docBase = 'https://docs.payzu.com.br/docs/conta-digital';
