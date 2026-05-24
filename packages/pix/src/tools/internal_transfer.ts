import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

export function registerInternalTransferTools(server: McpServer) {
  server.tool(
    'internal_transfer.create',
    `Transfere saldo pra outra conta PayZu por accountNumber (6 dígitos). Liquidação instantânea, sem passar pelo Pix tradicional. Doc: ${docBase}/endpoints/internal-transfer/post_internal_transfer`,
    {
      amount: z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL).'),
      accountNumber: z.string().regex(/^\d{6}$/).describe('AccountNumber de 6 dígitos do destinatário.'),
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url().optional(),
    },
    async (args) => {
      try {
        const { data } = await http.post('/internal-transfer', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'internal_transfer.get',
    `Consulta transferência interna por id OU clientReference. Doc: ${docBase}/endpoints/internal-transfer/get_internal_transfer`,
    {
      id: z.string().optional(),
      clientReference: z.string().optional(),
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/internal-transfer', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
