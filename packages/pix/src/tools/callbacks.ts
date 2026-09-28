import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, toQuery, SECRET_ONCE } from '../utils.js';
import { Limit, Page, SortDirection, TxStatus, TxType, WebhookEvent } from '../schemas.js';

const RESEND_LIMIT = 'Limite: 5 pedidos de reenvio por minuto por conta, somando todas as rotas de reenvio.';

const resendWindow = {
  createdAtFrom: z.string().describe('Início do período, ISO 8601 (obrigatório). No máximo 30 dias atrás.'),
  createdAtTo: z.string().describe('Fim do período, ISO 8601 (obrigatório). Janela máxima de 7 dias.'),
  transactionIds: z.array(z.string()).optional().describe('Restringe a IDs de transação específicos.'),
  transactionTypes: z.array(TxType).optional(),
  transactionStatus: z.array(TxStatus).optional(),
  transactionEndToEndIds: z.array(z.string()).optional().describe('Restringe a endToEndIds específicos.'),
};

export function registerCallbacksTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'callbacks_list',
    {
      title: 'Listar callbacks',
      description: `Lista paginada dos logs de callbacks (webhooks) das transações da conta. Útil para auditoria e debug: filtre por hasError para achar entregas que falharam. Doc: ${docBase}/endpoints/callbacks/get_user_callbacks`,
      inputSchema: {
        transactionId: z.string().optional(),
        webhookId: z.string().optional(),
        eventType: WebhookEvent.optional(),
        id: z.string().optional().describe('Id do callback.'),
        url: z.string().optional().describe('URL de destino do callback.'),
        status: z.number().int().optional().describe('Código HTTP devolvido pelo destino, ex: 200, 500.'),
        hasError: z.boolean().optional().describe('true: só entregas com erro.'),
        createdAtFrom: z.string().optional().describe('ISO 8601'),
        createdAtTo: z.string().optional().describe('ISO 8601'),
        sortBy: z.enum(['createdAt', 'status']).optional(),
        sortDirection: SortDirection.optional(),
        limit: Limit.optional(),
        page: Page.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/callbacks', { params: toQuery(args) });
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
        id: z.string().min(1),
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
      description: `Reenvia o callback de uma transação específica para a callbackUrl configurada. ${RESEND_LIMIT} Doc: ${docBase}/endpoints/callbacks/resend_user_callback_single`,
      inputSchema: {
        transactionId: z.string().min(1),
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
      description: `Reenvia múltiplos callbacks de uma só vez com base nos filtros. CUIDADO: use filtro estreito. ${RESEND_LIMIT} Doc: ${docBase}/endpoints/callbacks/resend_user_callbacks`,
      inputSchema: resendWindow,
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

  server.registerTool(
    'callbacks_resend_webhook',
    {
      title: 'Reenviar callbacks de um webhook',
      description: `Reenfileira as entregas que FALHARAM de um webhook específico. Use depois que o endpoint do cliente voltou do ar, para recuperar o que falhou naquele destino, sem reenviar o que já foi entregue nos outros. Aceitar não é entregar: a fila roda depois da resposta. ${RESEND_LIMIT} Doc: ${docBase}/endpoints/callbacks/resend_user_callbacks_webhook`,
      inputSchema: {
        webhookId: z.string().min(1).describe('Id do webhook cujas entregas serão reenviadas.'),
      },
    },
    async ({ webhookId }) => {
      try {
        const { data } = await http.post(`/user/callbacks/resend/webhook/${webhookId}`, {});
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_resend_webhook_bulk',
    {
      title: 'Reenviar entregas de webhooks por filtro',
      description: `Reenfileira as entregas de webhook que FALHARAM num período. Para cada webhook, transação e evento vale só a última tentativa do período, reenviada apenas se falhou. Os filtros se aplicam às transações dessas entregas; sem webhookIds, cobre todos os webhooks ativos da conta. Aceitar não é entregar: a fila roda depois da resposta. ${RESEND_LIMIT} Doc: ${docBase}/endpoints/callbacks/resend_user_callbacks_webhooks`,
      inputSchema: {
        ...resendWindow,
        webhookIds: z.array(z.string()).optional().describe('Webhooks a reenviar. Omita para todos os ativos.'),
      },
    },
    async (args) => {
      try {
        const { data } = await http.post('/user/callbacks/resend/webhook', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_create_secret',
    {
      title: 'Criar segredo de callback',
      description: `Cria o segredo de callback da conta, usado para assinar (header X-Callback-Signature) as entregas feitas ao callbackUrl das transações. ${SECRET_ONCE} Se a conta já tiver segredo, a API recusa: use callbacks_rotate_secret. Doc: ${docBase}/endpoints/callbacks/create_user_callback_secret`,
      inputSchema: {},
    },
    async () => {
      try {
        const { data } = await http.post('/user/callbacks/secret', {});
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'callbacks_rotate_secret',
    {
      title: 'Rotacionar segredo de callback',
      description: `Troca o segredo de callback da conta. As entregas passam a ser assinadas com o segredo novo NA HORA, o que QUEBRA a verificação de assinatura do receptor até ele passar a usar o segredo novo: confirme com o usuário antes e avise que ele precisa atualizar o sistema dele. ${SECRET_ONCE} Doc: ${docBase}/endpoints/callbacks/rotate_user_callback_secret`,
      inputSchema: {},
    },
    async () => {
      try {
        const { data } = await http.patch('/user/callbacks/secret/rotate', {});
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
