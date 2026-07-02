import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

const AccountNumber = z.string().regex(/^\d{6}$/);

async function resolvePayerAccountNumber(provided?: string): Promise<string> {
  if (provided) return provided;
  const { data } = await http.get('/user');
  const parsed = AccountNumber.safeParse(data?.accountNumber);
  if (!parsed.success) {
    throw new Error('Não foi possível resolver o payerAccountNumber da conta autenticada.');
  }
  return parsed.data;
}

export function registerInternalTransferTools(server: McpServer) {
  server.tool(
    'internal_transfer_create',
    `Transfere saldo entre contas PayZu por accountNumber (6 dígitos). Liquidação instantânea, sem passar pelo Pix tradicional. Se payerAccountNumber for omitido, usa a própria conta autenticada como pagadora. Doc: ${docBase}/endpoints/internal-transfer/post_internal_transfer`,
    {
      amount: z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL).'),
      receiverAccountNumber: AccountNumber.describe('AccountNumber de 6 dígitos do destinatário.'),
      payerAccountNumber: AccountNumber.optional().describe('AccountNumber de 6 dígitos do pagador (precisa pertencer à conta autenticada). Omita para resolver automaticamente.'),
      clientReference: z.string().min(1).max(64),
      description: z.string().max(500).optional(),
      callbackUrl: z.string().url().optional(),
      virtualAccount: z.string().min(1).max(50).optional().describe('Subconta virtual para correlacionar lojas ou filiais.'),
    },
    async ({ payerAccountNumber, ...rest }) => {
      try {
        const payer = await resolvePayerAccountNumber(payerAccountNumber);
        const { data } = await http.post('/internal-transfer', { ...rest, payerAccountNumber: payer });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'internal_transfer_get',
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
