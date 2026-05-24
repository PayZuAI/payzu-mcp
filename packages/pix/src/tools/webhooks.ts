import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

const EVENTS = [
  'TRANSACTION_PENDING',
  'TRANSACTION_COMPLETED',
  'TRANSACTION_CANCELED',
  'TRANSACTION_WAITING_FOR_REFUND',
  'TRANSACTION_REFUNDED',
  'TRANSACTION_EXPIRED',
  'TRANSACTION_ERROR',
  'TRANSACTION_SUSPECTED_FRAUD',
  'TRANSACTION_SUSPECTED_FRAUD_REVERSAL',
  'INFRACTION_CHANGED',
] as const;

const Events = z
  .array(z.enum(EVENTS))
  .describe('Eventos assinados. Omita ou mande vazio para receber todos.');

export function registerWebhookTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'webhooks_create',
    {
      title: 'Cadastrar webhook',
      description: `Cadastra uma URL HTTPS que recebe notificação quando a transação muda de estado. Use generateSecret para assinar as chamadas com HMAC, que é como o receptor confirma que a notificação veio da PayZu. Doc: ${docBase}/endpoints/webhooks/post_user_webhook`,
      inputSchema: {
        url: z.string().url().describe('URL HTTPS que vai receber os POSTs.'),
        events: Events.optional(),
        generateSecret: z
          .boolean()
          .optional()
          .describe('Gera segredo HMAC para assinar as notificações deste webhook.'),
        active: z.boolean().optional().describe('Se o webhook já nasce ativo.'),
      },
    },
    async (args) => {
      try {
        const payload = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.post('/user/webhooks', payload);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_list',
    {
      title: 'Listar webhooks',
      description: `Lista os webhooks cadastrados na conta, com URL, eventos assinados e estado. Doc: ${docBase}/endpoints/webhooks/get_user_webhooks`,
      inputSchema: {
        active: z.boolean().optional().describe('Filtra só os ativos ou só os inativos.'),
      },
    },
    async ({ active }) => {
      try {
        const { data } = await http.get('/user/webhooks', {
          params: active == null ? {} : { active },
        });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_get',
    {
      title: 'Consultar webhook',
      description: `Retorna um webhook pelo id. Doc: ${docBase}/endpoints/webhooks/get_user_webhook`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/webhooks/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_update',
    {
      title: 'Alterar webhook',
      description: `Muda URL, eventos assinados ou o estado de um webhook. Desativar para de entregar notificação sem apagar o cadastro. Doc: ${docBase}/endpoints/webhooks/patch_user_webhook`,
      inputSchema: {
        id: z.string().min(1),
        url: z.string().url().optional(),
        events: Events.optional(),
        active: z.boolean().optional(),
      },
    },
    async ({ id, ...body }) => {
      try {
        const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v != null));
        const { data } = await http.patch(`/user/webhooks/${id}`, payload);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_delete',
    {
      title: 'Remover webhook',
      description: `Apaga o cadastro do webhook. A conta PARA de receber notificação nessa URL. Se a intenção é só pausar, use webhooks_update com active false, que preserva o cadastro e o segredo. Confirme com o usuário antes de apagar. Doc: ${docBase}/endpoints/webhooks/delete_user_webhook`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.delete(`/user/webhooks/${id}`);
        return ok(data ?? { deleted: id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_rotate_secret',
    {
      title: 'Rotacionar segredo do webhook',
      description: `Gera um segredo HMAC novo para o webhook e invalida o anterior. QUEBRA a verificação de assinatura do receptor até ele passar a usar o segredo novo, então avise o usuário de que ele precisa atualizar o sistema dele. Doc: ${docBase}/endpoints/webhooks/post_user_webhook_rotate_secret`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.post(`/user/webhooks/${id}/rotate-secret`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_sent_quantity',
    {
      title: 'Contar entregas de webhook',
      description: `Quantidade de notificações enviadas, útil para saber se a entrega está acontecendo antes de investigar uma a uma. Doc: ${docBase}/endpoints/webhooks/get_user_webhooks_sent_quantity`,
      inputSchema: {
        webhookId: z.string().optional().describe('Restringe a contagem a um webhook.'),
      },
    },
    async ({ webhookId }) => {
      try {
        const { data } = await http.get('/user/webhooks/sent/quantity', {
          params: webhookId ? { webhookId } : {},
        });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'webhooks_sent_detail',
    {
      title: 'Detalhe de uma entrega',
      description: `Mostra o que foi enviado e o que o receptor respondeu numa entrega específica. É por aqui que se descobre por que uma notificação não chegou. Doc: ${docBase}/endpoints/webhooks/get_user_webhook_sent_detail`,
      inputSchema: {
        id: z.string().min(1).describe('Id do webhook.'),
        callbackId: z.string().min(1).describe('Id da entrega.'),
      },
    },
    async ({ id, callbackId }) => {
      try {
        const { data } = await http.get(`/user/webhooks/${id}/sent/${callbackId}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
