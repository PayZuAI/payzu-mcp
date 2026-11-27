import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, SECRET_ONCE, ADDITIVE, DESTRUCTIVE, READ_ONLY } from '../utils.js';
import { WebhookEvent } from '../schemas.js';

const Events = z
  .array(WebhookEvent)
  .describe('Eventos assinados. Omita ou mande vazio para receber todos.');

export function registerWebhookTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'webhooks_create',
    {
      title: 'Cadastrar webhook',
      annotations: ADDITIVE,
      description: `Cadastra uma URL HTTPS que recebe notificação quando a transação muda de estado. Use generateSecret para assinar as chamadas com HMAC, que é como o receptor confirma que a notificação veio da PayZu. Com generateSecret, a resposta traz o secret: ${SECRET_ONCE} Doc: ${docBase}/post-user-webhook`,
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
      annotations: READ_ONLY,
      description: `Lista os webhooks cadastrados na conta, com URL, eventos assinados e estado. Doc: ${docBase}/get-user-webhooks`,
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
      annotations: READ_ONLY,
      description: `Retorna um webhook pelo id. Doc: ${docBase}/get-user-webhook`,
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
      annotations: DESTRUCTIVE,
      description: `Muda URL, eventos assinados ou o estado de um webhook. Desativar para de entregar notificação sem apagar o cadastro. Doc: ${docBase}/patch-user-webhook`,
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
      annotations: DESTRUCTIVE,
      description: `Apaga o cadastro do webhook. A conta PARA de receber notificação nessa URL. Para só pausar, webhooks_update com active false preserva o cadastro e o segredo. Doc: ${docBase}/delete-user-webhook`,
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
      annotations: DESTRUCTIVE,
      description: `Gera um segredo HMAC novo para o webhook e invalida o anterior. QUEBRA a verificação de assinatura do receptor até ele passar a usar o segredo novo. ${SECRET_ONCE} Doc: ${docBase}/post-user-webhook-rotate-secret`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.post(`/user/webhooks/${id}/rotate-secret`, {});
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
      annotations: READ_ONLY,
      description: `Quantidade de notificações enviadas, útil para saber se a entrega está acontecendo antes de investigar uma a uma. Doc: ${docBase}/get-user-webhooks-sent-quantity`,
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
      annotations: READ_ONLY,
      description: `Mostra o que foi enviado e o que o receptor respondeu numa entrega específica. É por aqui que se descobre por que uma notificação não chegou. Doc: ${docBase}/get-user-webhook-sent-detail`,
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
