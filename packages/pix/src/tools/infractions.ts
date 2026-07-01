import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

export function registerInfractionsTools(server: McpServer) {
  server.tool(
    'infractions.list',
    `Lista infrações MED (Mecanismo Especial de Devolução do Bacen) abertas contra a conta autenticada. Doc: ${docBase}/endpoints/infractions/get_infractions`,
    {
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      page: z.number().int().min(1).optional(),
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

  server.tool(
    'infractions.get',
    `Detalhe completo de uma infração: motivo, valor contestado, prazo de defesa (dueDate), transação relacionada. Doc: ${docBase}/endpoints/infractions/get_infractions_by_id`,
    {
      id: z.string(),
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

  server.tool(
    'infractions.create_defense',
    `Submete defesa contra uma infração, com justificativa e anexos (notas fiscais, comprovantes). Cuidado: ação não reversível, valida com humano antes. Doc: ${docBase}/endpoints/infractions/post_infractions_defense`,
    {
      id: z.string().describe('ID da infração.'),
      justification: z.string().min(10),
      attachments: z.array(z.object({
        filename: z.string(),
        base64: z.string(),
      })).optional().describe('Anexos opcionais (base64).'),
    },
    async ({ id, ...rest }) => {
      try {
        const { data } = await http.post(`/user/infractions/${id}/defenses`, rest);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'infractions.list_defenses',
    `Lista todas as defesas submetidas para uma infração específica. Doc: ${docBase}/endpoints/infractions/get_infractions_defenses`,
    {
      id: z.string(),
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

  server.tool(
    'infractions.get_defense',
    `Detalhe de uma defesa específica. Doc: ${docBase}/endpoints/infractions/get_infractions_defense_by_id`,
    {
      id: z.string().describe('ID da infração.'),
      defenseId: z.string().describe('ID da defesa.'),
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
