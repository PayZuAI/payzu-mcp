import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, toQuery } from '../utils.js';
import { Document, Limit, Page, SortDirection, TxStatus, TxType, VirtualAccount } from '../schemas.js';

const ReportStatus = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);
const DepositPendingStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'COMPLETED']);

export function registerReportsTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'reports_list_transactions',
    {
      title: 'Listar transações',
      description: `Lista paginada das transações da conta (retorna total e pages). Filtros por status, tipo, método, período, valor, documento, nome, endToEndId, clientReference, virtualAccount e presença de QR Code. Doc: ${docBase}/endpoints/reports/get_user_transactions`,
      inputSchema: {
        status: z.array(TxStatus).optional(),
        type: z.array(TxType).optional(),
        method: z.array(z.enum(['PIX', 'INTERNAL_TRANSFER'])).optional(),
        dateFrom: z.string().optional().describe('ISO 8601, ex: 2026-05-01T00:00:00-03:00'),
        dateTo: z.string().optional().describe('ISO 8601'),
        id: z.string().optional(),
        amount: z.number().min(0.01).optional().describe('Valor exato em reais.'),
        document: Document.optional(),
        name: z.string().optional(),
        endToEndId: z.string().optional(),
        clientReference: z.string().max(64).optional(),
        virtualAccount: VirtualAccount.optional(),
        hasQrCode: z.boolean().optional().describe('true: só transações com QR Code; false: só sem.'),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortDirection: SortDirection.optional(),
        limit: Limit.optional(),
        page: Page.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/transactions', { params: toQuery(args) });
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
        id: z.string().min(1),
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
      description: `Lista paginada dos jobs de relatório criados pela conta autenticada, com filtro por status e período. Doc: ${docBase}/endpoints/reports/list_user_reports`,
      inputSchema: {
        status: z.array(ReportStatus).optional(),
        createdAtFrom: z.string().optional().describe('ISO 8601'),
        createdAtTo: z.string().optional().describe('ISO 8601'),
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
        const { data } = await http.get('/user/report', { params: toQuery(args) });
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
        id: z.string().min(1),
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
      description: `Retorna URL assinada (validade curta) para download do CSV. Só funciona com o job em COMPLETED; arquivo expirado não volta, gere outro. Doc: ${docBase}/endpoints/reports/download_user_report`,
      inputSchema: {
        id: z.string().min(1),
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
      description: `Extrato da conta na janela pedida, linha a linha, com operação, motivo e saldo antes e depois de cada lançamento. Diferente de reports_list_transactions, que lista transações Pix: aqui aparece TODO movimento de saldo, tarifa e ajuste inclusive. Doc: ${docBase}/endpoints/reports/get_user_bank_statements`,
      inputSchema: {
        createdAtFrom: z.string().describe('Início da janela, ISO 8601. Obrigatório.'),
        createdAtTo: z.string().describe('Fim da janela, ISO 8601. Obrigatório.'),
        id: z.string().optional().describe('Id do lançamento.'),
        operation: z.enum(['INCREMENT', 'DECREMENT']).optional().describe('INCREMENT é crédito e DECREMENT é débito.'),
        reason: z.string().optional(),
        transactionId: z.string().optional(),
        amountFrom: z.number().optional(),
        amountTo: z.number().optional(),
        sortBy: z.enum(['createdAt', 'amount']).optional(),
        sortDirection: SortDirection.optional(),
        page: Page.optional(),
        limit: Limit.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/bank-statements', { params: toQuery(args) });
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
        status: z.array(DepositPendingStatus).optional(),
        document: Document.optional().describe('CPF (11) ou CNPJ (14) do pagador, só dígitos.'),
        name: z.string().optional().describe('Nome do pagador ou do recebedor.'),
        endToEndId: z.string().optional(),
        amountMin: z.number().min(0.01).optional(),
        amountMax: z.number().min(0.01).optional(),
        createdAtFrom: z.string().optional().describe('ISO 8601'),
        createdAtTo: z.string().optional().describe('ISO 8601'),
        page: Page.optional(),
        limit: Limit.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/deposit-pending', { params: toQuery(args) });
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
      description: `Totais consolidados do período para depósitos, saques, comissões e ajustes, com contagem e valor por status. Responde "quanto entrou este mês" sem baixar a lista inteira de transações. Sem datas, cobre do início do dia anterior (horário de Brasília) até agora. Doc: ${docBase}/endpoints/reports/get_user_summary`,
      inputSchema: {
        dateFrom: z.string().optional().describe('Início do período, ISO 8601.'),
        dateTo: z.string().optional().describe('Fim do período, ISO 8601.'),
        groupBy: z.enum(['day']).optional(),
        grouped: z.boolean().optional().describe('true devolve também a série agrupada por dia.'),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/user/summary', { params: toQuery(args) });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
