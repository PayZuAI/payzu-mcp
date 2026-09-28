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
      title: 'Consultar chave Pix para pagamento',
      description: `Consulta no DICT uma chave Pix de terceiro antes de pagar e retorna o titular (nome e documento formatado), tipo de pessoa, tipo de conta e instituição. Exige token com permissão WITHDRAW. Não lista as chaves da própria conta. Para a mesma consulta com agência e número da conta, ou com token só de DEPOSIT, use withdraw_dict. Doc: ${docBase}/endpoints/keys-and-dict/get_user_dict`,
      inputSchema: {
        key: z.string().min(1).max(77).describe('Chave Pix a consultar: CPF, CNPJ, telefone +55 com DDD, e-mail ou EVP.'),
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
