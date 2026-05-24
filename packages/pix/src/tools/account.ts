import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

export function registerAccountTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'account_profile',
    {
      title: 'Perfil da conta',
      description: `Retorna o perfil, as permissões, os limites e as regras de tarifa da conta autenticada. Doc: ${docBase}/endpoints/account/get_user`,
      inputSchema: {},
    },
    async () => {
      try {
        const { data } = await http.get('/user');
        const { id, role, ...profile } = (data ?? {}) as Record<string, unknown>;
        return ok(profile);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'account_balance',
    {
      title: 'Saldo da conta',
      description: `Retorna o saldo disponível e o saldo bloqueado da conta autenticada. Doc: ${docBase}/endpoints/account/get_user_balance`,
      inputSchema: {},
    },
    async () => {
      try {
        const { data } = await http.get('/user/balance');
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'account_pix_keys',
    {
      title: 'Chaves Pix da conta',
      description: `Consulta uma chave Pix registrada NA PRÓPRIA conta, para conferir titularidade antes de divulgar a chave. Não confunde com withdraw_dict, que consulta chave de TERCEIRO no DICT antes de pagar. Doc: ${docBase}/endpoints/keys-and-dict/get_user_dict`,
      inputSchema: {
        key: z.string().min(1).describe('A chave Pix a consultar.'),
      },
    },
    async ({ key }) => {
      try {
        const { data } = await http.get('/user/dict', { params: { key } });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
