import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, okImage, fail, docBase, toQuery } from '../utils.js';
import { CallbackUrl, Document, VirtualAccount } from '../schemas.js';

const Amount = z
  .number()
  .min(1)
  .multipleOf(0.01)
  .describe('Valor em REAIS decimais (BRL), mínimo 1.00. Ex: R$ 99,90 = 99.90. NUNCA em centavos.');

export function registerPixTools(server: McpServer, http: AxiosInstance) {
  server.registerTool(
    'pix_create',
    {
      title: 'Criar cobrança Pix',
      description: `Cria uma cobrança Pix dinâmica e retorna QR Code + ID. Use clientReference único e determinístico (ex: order-123) para idempotência: repetir o mesmo clientReference devolve a cobrança já criada. callbackUrl é opcional; informe só se o cliente tiver um sistema pra receber notificações. Doc: ${docBase}/endpoints/pix-operations/post_pix`,
      inputSchema: {
        amount: Amount,
        clientReference: z.string().min(1).max(64).describe('Identificador externo único e determinístico (ex: order-123 ou UUID v4).'),
        callbackUrl: CallbackUrl.optional(),
        generatedName: z
          .string()
          .min(1)
          .regex(/^[a-zA-Z À-ÿ]+$/)
          .optional()
          .describe('Nome completo do pagador, só letras e espaços.'),
        generatedDocument: Document.optional().describe('CPF (11) ou CNPJ (14) do pagador, só dígitos e com dígito verificador válido.'),
        generatedEmail: z.string().email().optional().describe('E-mail do pagador.'),
        expiresIn: z.number().int().positive().max(172000).optional().describe('Segundos até o QR Code expirar (máx 172000).'),
        virtualAccount: VirtualAccount.optional(),
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
      description: `Consulta uma cobrança Pix por id, clientReference, endToEndId ou virtualAccount. Informe ao menos um; se informar mais de um, todos precisam bater na mesma cobrança. Retorna status atual e detalhes. Doc: ${docBase}/endpoints/pix-operations/get_pix`,
      inputSchema: {
        id: z.string().optional(),
        clientReference: z.string().max(64).optional(),
        endToEndId: z.string().optional(),
        virtualAccount: VirtualAccount.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/pix', { params: toQuery(args) });
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
      description: `Retorna a imagem PNG do QR Code de uma cobrança Pix. O código copia-e-cola vem em qrCodeText, via pix_get. Doc: ${docBase}/endpoints/pix-operations/get_pix_qrcode`,
      inputSchema: {
        id: z.string().min(1).describe('ID da cobrança Pix (retornado por pix_create).'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get<ArrayBuffer>(`/pix/qr-code/${id}`, { responseType: 'arraybuffer' });
        return okImage(data, 'image/png');
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'pix_proof',
    {
      title: 'Comprovante Pix',
      description: `Retorna o comprovante de uma transação Pix em PDF, como data URI base64 no campo base64. Doc: ${docBase}/endpoints/pix-operations/get_proof`,
      inputSchema: {
        id: z.string().min(1).describe('ID da transação.'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/proof/${id}`, { params: { type: 'base64' } });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
