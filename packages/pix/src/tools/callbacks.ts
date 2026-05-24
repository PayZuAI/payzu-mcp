import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

export function registerCallbacksTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'callbacks_list',
    {
      title: 'Listar callbacks',
      description: `Lista paginada dos logs de callbacks (webhooks) das transações da conta. Útil para auditoria e debug. Doc: ${docBase}/endpoints/callbacks/get_user_callbacks`,
      inputSchema: {
        transactionId: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/callbacks', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_get',
    {
      title: 'Consultar callback',
      description: `Retorna os detalhes completos de um callback específico: body enviado, resposta recebida, tempo de round-trip. Doc: ${docBase}/endpoints/callbacks/get_user_callback_by_id`,
      inputSchema: {
        id: z.string(),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/callbacks/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_resend',
    {
      title: 'Reenviar callback',
      description: `Reenvia o callback de uma transação específica para a callbackUrl configurada. Doc: ${docBase}/endpoints/callbacks/resend_user_callback_single`,
      inputSchema: {
        transactionId: z.string(),
      },
    },
    async ({ transactionId }) => {
      try {
        const { data } = await http.post(`/user/callbacks/resend/${transactionId}`, {});
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_resend_bulk',
    {
      title: 'Reenviar callbacks em lote',
      description: `Reenvia múltiplos callbacks de uma só vez com base nos filtros. CUIDADO: use filtro estreito. Doc: ${docBase}/endpoints/callbacks/resend_user_callbacks`,
      inputSchema: {
        createdAtFrom: z.string().describe('ISO 8601 (obrigatório). Máx 30 dias no passado.'),
        createdAtTo: z.string().describe('ISO 8601 (obrigatório). Janela máx 7 dias.'),
        transactionIds: z.array(z.string()).optional().describe('Restringe a IDs específicos'),
        transactionTypes: z.array(z.enum(['DEPOSIT', 'WITHDRAW', 'COMMISSION'])).optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.post('/user/callbacks/resend', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
