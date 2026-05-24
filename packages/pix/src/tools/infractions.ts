import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;
const BASE64_CONTENT = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BLOCKED_EXTENSION = /\.(?:exe|msi|bat|cmd|sh)$/i;

const Attachment = z.object({
  filename: z.string().min(1).max(255).refine(
    (name) => !/[\\/]/.test(name) && !BLOCKED_EXTENSION.test(name),
    'Nome de arquivo inválido ou extensão executável.',
  ),
  base64: z.string().min(1).regex(BASE64_CONTENT, 'Conteúdo deve estar em base64.'),
});

const Attachments = z.array(Attachment)
  .refine(
    (files) => files.reduce((total, file) => total + Buffer.byteLength(file.base64, 'base64'), 0) <= MAX_ATTACHMENTS_TOTAL_BYTES,
    'Anexos excedem 10MB no total.',
  );

interface DefenseAttachment {
  filename: string;
  base64: string;
}

function defenseForm(defense: string, attachments: DefenseAttachment[] = []): FormData {
  const form = new FormData();
  form.append('defense', defense);
  for (const file of attachments) {
    form.append('files', new Blob([Buffer.from(file.base64, 'base64')]), file.filename);
  }
  return form;
}

export function registerInfractionsTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'infractions_list',
    {
      title: 'Listar infrações (MED)',
      description: `Lista infrações MED (Mecanismo Especial de Devolução do Bacen) abertas contra a conta autenticada. Doc: ${docBase}/endpoints/infractions/get_infractions`,
      inputSchema: {
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/infractions', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'infractions_get',
    {
      title: 'Consultar infração',
      description: `Detalhe completo de uma infração: motivo, valor contestado, prazo de defesa (dueDate), transação relacionada. Doc: ${docBase}/endpoints/infractions/get_infractions_by_id`,
      inputSchema: {
        id: z.string(),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/infractions/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'infractions_create_defense',
    {
      title: 'Enviar defesa de infração',
      description: `Submete defesa contra uma infração aberta, com texto (máx 1000 caracteres) e anexos (notas fiscais, comprovantes; máx 10MB no total, extensões executáveis recusadas). Cuidado: ação não reversível, valide com humano antes. Doc: ${docBase}/endpoints/infractions/post_infractions_defense`,
      inputSchema: {
        id: z.string().describe('ID da infração.'),
        defense: z.string().min(10).max(1000).describe('Texto da defesa (entre 10 e 1000 caracteres).'),
        attachments: Attachments.optional().describe('Anexos opcionais (conteúdo em base64).'),
      },
    },
    async ({ id, defense, attachments }) => {
      try {
        const { data } = await http.post(`/user/infractions/${id}/defenses`, defenseForm(defense, attachments), {
          headers: { 'Content-Type': undefined },
        });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'infractions_list_defenses',
    {
      title: 'Listar defesas de infração',
      description: `Lista todas as defesas submetidas para uma infração específica. Doc: ${docBase}/endpoints/infractions/get_infractions_defenses`,
      inputSchema: {
        id: z.string(),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/infractions/${id}/defenses`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'infractions_get_defense',
    {
      title: 'Consultar defesa de infração',
      description: `Detalhe de uma defesa específica. Doc: ${docBase}/endpoints/infractions/get_infractions_defense_by_id`,
      inputSchema: {
        id: z.string().describe('ID da infração.'),
        defenseId: z.string().describe('ID da defesa.'),
      },
    },
    async ({ id, defenseId }) => {
      try {
        const { data } = await http.get(`/user/infractions/${id}/defenses/${defenseId}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
