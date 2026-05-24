import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase } from '../utils.js';

const Amount = z
  .number()
  .positive()
  .multipleOf(0.01)
  .describe('Valor em REAIS decimais (BRL). Ex: R$ 99,90 = 99.90. NUNCA em centavos.');

export function registerPixTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'pix_create',
    {
      title: 'Criar cobrança Pix',
      description: `Cria uma cobrança Pix dinâmica e retorna QR Code + ID. Use clientReference único e determinístico (ex: order-123) para idempotência. callbackUrl é opcional; informe só se o cliente tiver um sistema pra receber notificações. Doc: ${docBase}/endpoints/pix-operations/post_pix`,
      inputSchema: {
        amount: Amount,
        clientReference: z.string().min(1).max(64).describe('Identificador externo único e determinístico (ex: order-123 ou UUID v4).'),
        callbackUrl: z.string().url().optional().describe('Opcional: URL HTTPS que recebe um POST quando o status muda. Se omitir, nenhum callback é enviado — consulte o status depois com a tool de consulta.'),
        generatedName: z.string().min(1).optional().describe('Nome de quem está cobrando (aparece pro pagador).'),
        generatedDocument: z.string().min(11).max(14).optional().describe('CPF (11) ou CNPJ (14) sem formatação.'),
        generatedEmail: z.string().email().optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.post('/pix', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'pix_get',
    {
      title: 'Consultar cobrança Pix',
      description: `Consulta uma cobrança Pix por id, clientReference OU endToEndId (use apenas um). Retorna status atual e detalhes. Doc: ${docBase}/endpoints/pix-operations/get_pix`,
      inputSchema: {
        id: z.string().optional(),
        clientReference: z.string().optional(),
        endToEndId: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/pix', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'pix_qr_code',
    {
      title: 'QR Code da cobrança',
      description: `Retorna o QR Code de uma cobrança Pix renderizado como imagem PNG (URL ou base64). Doc: ${docBase}/endpoints/pix-operations/get_pix_qrcode`,
      inputSchema: {
        id: z.string().describe('ID da cobrança Pix (retornado por pix_create).'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/pix/qr-code/${id}`);
        return ok(data, []);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'pix_proof',
    {
      title: 'Comprovante Pix',
      description: `Retorna o comprovante de uma transação Pix em PDF base64 ou JSON estruturado. Doc: ${docBase}/endpoints/pix-operations/get_proof`,
      inputSchema: {
        id: z.string().describe('ID da transação.'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/proof/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
