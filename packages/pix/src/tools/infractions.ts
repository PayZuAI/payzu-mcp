import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, toQuery } from '../utils.js';
import { Document, Limit, Page, SortDirection } from '../schemas.js';

const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;
const BASE64_CONTENT = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BLOCKED_EXTENSION = /\.(?:exe|msi|bat|cmd|sh)$/i;
const MAX_ATTACHMENTS = 5;

const InfractionStatus = z.enum(['WAITING_PSP', 'CLOSED', 'OPEN', 'CANCELLED', 'ACKNOWLEDGED', 'DEFENDED', 'ANSWERED', 'WAITING_ADJUSTMENTS']);
const InfractionType = z.enum(['REFUND_REQUEST', 'FRAUD', 'REFUND_CANCELLED']);

const Attachment = z.object({
  filename: z.string().min(1).max(255).refine(
    (name) => !/[\\/]/.test(name) && !BLOCKED_EXTENSION.test(name),
    'Nome de arquivo inválido ou extensão executável.',
  ),
  base64: z.string().min(1).regex(BASE64_CONTENT, 'Conteúdo deve estar em base64.'),
});

const Attachments = z.array(Attachment)
  .max(MAX_ATTACHMENTS, 'No máximo 5 anexos.')
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
      description: `Lista paginada das infrações MED (Mecanismo Especial de Devolução do Bacen) da conta autenticada, com filtros por status, tipo, transação, valor, participante e datas (expiresAt é o prazo de defesa). Doc: ${docBase}/endpoints/infractions/get_infractions`,
      inputSchema: {
        status: z.array(InfractionStatus).optional(),
        type: z.array(InfractionType).optional(),
        id: z.string().optional(),
        protocol: z.string().optional(),
        transactionId: z.string().optional(),
        endToEndId: z.string().optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        analysisResult: z.array(z.enum(['AGREED', 'DISAGREED'])).optional(),
        reportedBy: z.array(z.enum(['DEBITED_PARTICIPANT', 'CREDITED_PARTICIPANT'])).optional(),
        participantDocument: Document.optional(),
        participantName: z.string().optional(),
        reportedAtFrom: z.string().optional().describe('ISO 8601'),
        reportedAtTo: z.string().optional().describe('ISO 8601'),
        createdAtFrom: z.string().optional().describe('ISO 8601'),
        createdAtTo: z.string().optional().describe('ISO 8601'),
        expiresAtFrom: z.string().optional().describe('Prazo de defesa a partir de, ISO 8601.'),
        expiresAtTo: z.string().optional().describe('Prazo de defesa até, ISO 8601.'),
        updatedAtFrom: z.string().optional().describe('ISO 8601'),
        updatedAtTo: z.string().optional().describe('ISO 8601'),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortDirection: SortDirection.optional(),
        limit: Limit.optional(),
        page: Page.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/infractions', { params: toQuery(args) });
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
      description: `Detalhe completo de uma infração: tipo, status, relato, prazo de defesa (expiresAt), resultado da análise, transação relacionada e histórico de defesas. Doc: ${docBase}/endpoints/infractions/get_infractions_by_id`,
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
      description: `Submete defesa contra uma infração aberta, com texto (máx 1000 caracteres) e anexos (notas fiscais, comprovantes; até 5 arquivos e 10MB no total, extensões executáveis recusadas). Cuidado: ação não reversível, valide com humano antes. Doc: ${docBase}/endpoints/infractions/post_infractions_defense`,
      inputSchema: {
        id: z.string().describe('ID da infração.'),
        defense: z.string().min(1).max(1000).describe('Texto da defesa (até 1000 caracteres).'),
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
