import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, registerCashOutUnavailable, toQuery } from '../utils.js';
import { CallbackUrl, VirtualAccount } from '../schemas.js';

const AccountNumber = z.string().regex(/^\d{6}$/);

async function resolvePayerAccountNumber(http: AxiosInstance, provided?: string): Promise<string> {
  if (provided) return provided;
  const { data } = await http.get('/user');
  const parsed = AccountNumber.safeParse(data?.accountNumber);
  if (!parsed.success) {
    throw new Error('Não foi possível resolver o payerAccountNumber da conta autenticada.');
  }
  return parsed.data;
}

export function registerInternalTransferTools(server: McpServer, http: AxiosInstance, enableCashOut = false) {
  if (!enableCashOut) {
    registerCashOutUnavailable(server, 'internal_transfer_create', 'Transferência interna');
  }
  if (enableCashOut) {
  server.registerTool(
    'internal_transfer_create',
    {
      title: 'Transferência interna',
      description: `Transfere saldo entre contas PayZu por accountNumber (6 dígitos). Liquidação instantânea, sem passar pelo Pix tradicional. Se payerAccountNumber for omitido, usa a própria conta autenticada como pagadora. Doc: ${docBase}/endpoints/internal-transfer/post_internal_transfer`,
      inputSchema: {
        amount: z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL).'),
        receiverAccountNumber: AccountNumber.describe('AccountNumber de 6 dígitos do destinatário.'),
        payerAccountNumber: AccountNumber.optional().describe('AccountNumber de 6 dígitos do pagador (precisa pertencer à conta autenticada). Omita para resolver automaticamente.'),
        clientReference: z.string().min(1).max(64),
        description: z.string().max(500).optional(),
        callbackUrl: CallbackUrl.optional(),
        virtualAccount: VirtualAccount.optional(),
      },
    },
    async ({ payerAccountNumber, ...rest }) => {
      try {
        const payer = await resolvePayerAccountNumber(http, payerAccountNumber);
        const { data } = await http.post('/internal-transfer', { ...rest, payerAccountNumber: payer });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
  }

  server.registerTool(
    'internal_transfer_get',
    {
      title: 'Consultar transferência interna',
      description: `Consulta transferência interna por id, clientReference ou virtualAccount. Informe ao menos um; se informar mais de um, todos precisam bater na mesma transferência. Doc: ${docBase}/endpoints/internal-transfer/get_internal_transfer`,
      inputSchema: {
        id: z.string().optional(),
        clientReference: z.string().max(64).optional(),
        virtualAccount: VirtualAccount.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/internal-transfer', { params: toQuery(args) });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
