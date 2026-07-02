import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

export function registerAccountTools(server: McpServer) {
  server.tool(
    'account_profile',
    `Retorna o perfil, as permissões, os limites e as regras de tarifa da conta autenticada. Doc: ${docBase}/endpoints/account/get_user`,
    {},
    async () => {
      try {
        const { data } = await http.get('/user');
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'account_balance',
    `Retorna o saldo disponível e o saldo bloqueado da conta autenticada. Doc: ${docBase}/endpoints/account/get_user_balance`,
    {},
    async () => {
      try {
        const { data } = await http.get('/user/balance');
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
