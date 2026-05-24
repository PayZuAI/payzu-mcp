import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

export function registerCallbacksTools(server: McpServer) {
  server.tool(
    'callbacks.list',
    `Lista paginada dos logs de callbacks (webhooks) das transações da conta. Útil para auditoria e debug. Doc: ${docBase}/endpoints/callbacks/get_user_callbacks`,
    {
      transactionId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
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

  server.tool(
    'callbacks.get',
    `Retorna os detalhes completos de um callback específico: body enviado, resposta recebida, tempo de round-trip. Doc: ${docBase}/endpoints/callbacks/get_user_callback_by_id`,
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/callback/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'callbacks.resend',
    `Reenvia o callback de uma transação específica para a callbackUrl configurada. Doc: ${docBase}/endpoints/callbacks/resend_user_callback_single`,
    {
      transactionId: z.string(),
    },
    async ({ transactionId }) => {
      try {
        const { data } = await http.post(`/user/callback/${transactionId}/resend`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'callbacks.resend_bulk',
    `Reenvia múltiplos callbacks de uma só vez com base nos filtros. CUIDADO: use filtro estreito. Doc: ${docBase}/endpoints/callbacks/resend_user_callbacks`,
    {
      startDate: z.string().describe('ISO 8601'),
      endDate: z.string().describe('ISO 8601'),
      status: z.string().optional(),
      type: z.enum(['DEPOSIT', 'WITHDRAW']).optional(),
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
