import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, registerCashOutUnavailable } from '../utils.js';

const Amount = z
  .number()
  .positive()
  .multipleOf(0.01)
  .describe(
    'Valor em REAIS decimais (BRL). Ex: R$ 99,90 = 99.90. NUNCA em centavos: 9990 seria aceito como R$ 9.990,00.',
  );

export function registerRefundTools(server: McpServer, http: AxiosInstance, enableCashOut = true) {
  if (!enableCashOut) {
    registerCashOutUnavailable(server, 'refund_create', 'Estornar cobrança');
    return;
  }

  server.registerTool(
    'refund_create',
    {
      title: 'Estornar cobrança Pix',
      description: `Devolve ao pagador o valor de uma cobrança Pix já recebida. AÇÃO IRREVERSÍVEL: o dinheiro sai da conta e não volta. Confirme o valor e o transactionId com o usuário antes de chamar. Omita amount para estornar o valor cheio; informe amount para estorno parcial. Doc: ${docBase}/endpoints/refunds/post_refund`,
      inputSchema: {
        transactionId: z.string().min(1).describe('Id da transação de entrada que será estornada.'),
        amount: Amount.optional().describe(
          'Opcional: valor a estornar, em reais. Omita para estornar o valor total da transação.',
        ),
        description: z.string().optional().describe('Texto livre que descreve o motivo do estorno.'),
        clientReference: z
          .string()
          .max(64)
          .optional()
          .describe(
            'Chave de idempotência. Repetir com o MESMO valor devolve o estorno já feito; repetir com valor diferente é recusado.',
          ),
      },
    },
    async ({ transactionId, ...body }) => {
      try {
        const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v != null));
        const { data } = await http.post(`/refund/${transactionId}`, payload);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
