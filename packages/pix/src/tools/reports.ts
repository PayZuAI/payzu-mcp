import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

const TxStatus = z.enum(['PENDING', 'COMPLETED', 'CANCELED', 'WAITING_FOR_REFUND', 'REFUNDED', 'EXPIRED', 'ERROR']);
const TxType = z.enum(['DEPOSIT', 'WITHDRAW', 'COMMISSION']);

export function registerReportsTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'reports_list_transactions',
    {
      title: 'Listar transações',
      description: `Lista paginada das transações da conta. Aceita filtros por status, type, período e clientReference. Doc: ${docBase}/endpoints/reports/get_user_transactions`,
      inputSchema: {
        status: TxStatus.optional(),
        type: TxType.optional(),
        dateFrom: z.string().optional().describe('ISO 8601, ex: 2026-05-01T00:00:00Z'),
        dateTo: z.string().optional(),
        clientReference: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/transactions', { params });
        return ok(data, ['qrCodeBase64', 'qrCodeText', 'qrCodeUrl']);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_get_transaction',
    {
      title: 'Consultar transação',
      description: `Retorna uma transação específica com logs de callback e infrações vinculadas. Doc: ${docBase}/endpoints/reports/get_user_transaction_by_id`,
      inputSchema: {
        id: z.string(),
      },
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

  server.registerTool(
    'reports_create_csv',
    {
      title: 'Gerar relatório CSV',
      description: `Cria um job assíncrono que gera CSV de transações para o período/filtros. Use para janelas grandes (mês, ano). Acompanhe via reports_get_job. Doc: ${docBase}/endpoints/reports/post_user_report`,
      inputSchema: {
        dateFrom: z.string().describe('ISO 8601'),
        dateTo: z.string().describe('ISO 8601'),
        status: z.array(TxStatus).optional(),
        type: z.array(TxType).optional(),
      },
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

  server.registerTool(
    'reports_list_jobs',
    {
      title: 'Listar relatórios',
      description: `Lista jobs de relatório criados pela conta autenticada. Doc: ${docBase}/endpoints/reports/list_user_reports`,
      inputSchema: {},
    },
    async () => {
      try {
        const { data } = await http.get('/user/report');
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_get_job',
    {
      title: 'Consultar relatório',
      description: `Retorna o status de um job de relatório (PENDING, RUNNING, COMPLETED, FAILED). Doc: ${docBase}/endpoints/reports/get_user_report`,
      inputSchema: {
        id: z.string(),
      },
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

  server.registerTool(
    'reports_download',
    {
      title: 'Baixar relatório',
      description: `Retorna URL assinada (validade curta) para download do CSV. Doc: ${docBase}/endpoints/reports/download_user_report`,
      inputSchema: {
        id: z.string(),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.post(`/user/report/${id}/download`, {});
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_bank_statements',
    {
      title: 'Extrato bancário',
      description: `Extrato da conta na janela pedida, linha a linha, com operação e motivo de cada lançamento. Diferente de reports_list_transactions, que lista transações Pix: aqui aparece TODO movimento de saldo, tarifa e ajuste inclusive. Doc: ${docBase}/endpoints/reports/get_user_bank_statements`,
      inputSchema: {
        createdAtFrom: z.string().describe('Início da janela, ISO 8601. Obrigatório.'),
        createdAtTo: z.string().describe('Fim da janela, ISO 8601. Obrigatório.'),
        operation: z.string().optional(),
        reason: z.string().optional(),
        transactionId: z.string().optional(),
        amountFrom: z.number().optional(),
        amountTo: z.number().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/bank-statements', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_bank_statement',
    {
      title: 'Lançamento do extrato',
      description: `Detalhe de um lançamento do extrato pelo id. Doc: ${docBase}/endpoints/reports/get_user_bank_statement`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/bank-statements/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_deposit_pending',
    {
      title: 'Depósitos pendentes',
      description: `Depósitos que chegaram mas ainda não foram conciliados com uma cobrança. É onde se procura o Pix que o cliente diz ter pago e não apareceu. Doc: ${docBase}/endpoints/reports/get_user_deposit_pending`,
      inputSchema: {
        status: z.string().optional(),
        document: z.string().optional().describe('CPF ou CNPJ do pagador, sem formatação.'),
        name: z.string().optional(),
        endToEndId: z.string().optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        createdAtFrom: z.string().optional(),
        createdAtTo: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/user/deposit-pending', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_deposit_pending_get',
    {
      title: 'Depósito pendente',
      description: `Detalhe de um depósito pendente pelo id. Doc: ${docBase}/endpoints/reports/get_user_deposit_pending_by_id`,
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/user/deposit-pending/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'reports_summary',
    {
      title: 'Resumo da conta',
      description: `Totais consolidados do período: entradas, saídas e contagens. Responde "quanto entrou este mês" sem baixar a lista inteira de transações. Doc: ${docBase}/endpoints/reports/get_user_summary`,
      inputSchema: {
        dateFrom: z.string().optional().describe('Início do período, ISO 8601.'),
        dateTo: z.string().optional().describe('Fim do período, ISO 8601.'),
        groupBy: z.string().optional(),
        grouped: z.boolean().optional(),
      },
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
