import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

const TxStatus = z.enum(['PENDING', 'COMPLETED', 'CANCELED', 'WAITING_FOR_REFUND', 'REFUNDED', 'EXPIRED', 'ERROR']);
const TxType = z.enum(['DEPOSIT', 'WITHDRAW', 'COMMISSION']);

export function registerReportsTools(server: McpServer) {
  server.tool(
    'reports.list_transactions',
    `Lista paginada das transações da conta. Aceita filtros por status, type, período e clientReference. Doc: ${docBase}/endpoints/reports/get_user_transactions`,
    {
      status: TxStatus.optional(),
      type: TxType.optional(),
      dateFrom: z.string().optional().describe('ISO 8601, ex: 2026-05-01T00:00:00Z'),
      dateTo: z.string().optional(),
      clientReference: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      page: z.number().int().min(1).optional(),
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
    'reports.get_transaction',
    `Retorna uma transação específica com logs de callback e infrações vinculadas. Doc: ${docBase}/endpoints/reports/get_user_transaction_by_id`,
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/transactions/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'reports.create_csv',
    `Cria um job assíncrono que gera CSV de transações para o período/filtros. Use para janelas grandes (mês, ano). Acompanhe via reports.get_job. Doc: ${docBase}/endpoints/reports/post_user_report`,
    {
      dateFrom: z.string().describe('ISO 8601'),
      dateTo: z.string().describe('ISO 8601'),
      status: z.array(TxStatus).optional(),
      type: z.array(TxType).optional(),
    },
    async (args) => {
      try {
        const { data } = await http.post('/user/report', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'reports.list_jobs',
    `Lista jobs de relatório criados pela conta autenticada. Doc: ${docBase}/endpoints/reports/list_user_reports`,
    {},
    async () => {
      try {
        const { data } = await http.get('/user/report');
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'reports.get_job',
    `Retorna o status de um job de relatório (PENDING, RUNNING, COMPLETED, FAILED). Doc: ${docBase}/endpoints/reports/get_user_report`,
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/report/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'reports.download',
    `Retorna URL assinada (validade curta) para download do CSV. Doc: ${docBase}/endpoints/reports/download_user_report`,
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const { data } = await http.post(`/user/report/${id}/download`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
