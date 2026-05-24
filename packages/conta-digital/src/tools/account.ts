import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

export function registerAccountTools(server: McpServer) {
  server.tool(
    'account.balance',
    `Consulta saldo disponível, bloqueado e liberado para saque. Ideal para controle financeiro e conciliação. Doc: ${docBase}/gestao-de-conta/getUserBalance`,
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

  server.tool(
    'account.profile',
    `Dados completos da conta: limites operacionais, taxas, chave Pix vinculada, permissões. Doc: ${docBase}/gestao-de-conta/getUser`,
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
    'account.transactions',
    `Extrato paginado de transações. Filtre por período, tipo, status, valor. Use cursor pra paginar. Doc: ${docBase}/gestao-de-conta/getUserTransactions`,
    {
      status: z.enum(['PENDING', 'COMPLETED', 'CANCELED', 'REFUNDED', 'EXPIRED']).optional(),
      type: z.enum(['DEPOSIT', 'WITHDRAW']).optional(),
      startDate: z.string().optional().describe('ISO 8601'),
      endDate: z.string().optional().describe('ISO 8601'),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/transactions', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'account.summary',
    `Relatório de performance: volumes transacionados, taxas de conversão, tendências por período. Ideal pra dashboards. Doc: ${docBase}/gestao-de-conta/getUserSummary`,
    {
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/summary', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
