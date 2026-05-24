import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

export const docBase = 'https://docs.payzu.com.br/docs/pix-processamento';

const CASHOUT_UNAVAILABLE = [
  'Esta operação (que movimenta dinheiro para fora da conta) NÃO está disponível neste conector hospedado.',
  'Motivo: por segurança, o saque depende da lista de IPs autorizados da conta, e este servidor é compartilhado — então o controle de IP não se aplica aqui.',
  '',
  'Como o cliente pode sacar/transferir:',
  '1. Aplicativo local do PayZu no Claude Desktop — baixe payzu-mcp-pix.mcpb em https://github.com/PayZuAI/payzu-mcp/releases/latest e abra o arquivo. Ele roda no computador do cliente, saindo do IP dele, onde a lista de IPs funciona normalmente.',
  '2. Ou diretamente pelo painel: https://web.payzu.processamento.com (Processamento) ou https://hub.payzu.com.br (Hub).',
  '',
  'Explique isso ao cliente de forma simples e ofereça as duas opções. Não tente contornar chamando outra ferramenta.',
].join('\n');

export function registerCashOutUnavailable(server: McpServer, name: string, title: string) {
  server.registerTool(
    name,
    {
      title: `${title} (indisponível aqui)`,
      description: `INDISPONÍVEL neste servidor hospedado. ${CASHOUT_UNAVAILABLE}`,
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text' as const, text: CASHOUT_UNAVAILABLE }] }),
  );
}
