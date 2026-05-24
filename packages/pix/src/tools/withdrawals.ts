import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, registerCashOutUnavailable } from '../utils.js';

const Amount = z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL). NUNCA em centavos.');
const PixType = z.enum(['cpf', 'cnpj', 'phone', 'email', 'evp']).describe('Tipo da chave Pix. phone usa formato 5511...');

export function registerWithdrawalTools(server: McpServer, http: AxiosInstance, enableCashOut = false) {
  if (!enableCashOut) {
    registerCashOutUnavailable(server, 'withdraw_create', 'Criar saque');
    registerCashOutUnavailable(server, 'withdraw_by_qr', 'Pagar QR Code (saque)');
  }
  if (enableCashOut) {
  server.registerTool(
    'withdraw_create',
    {
      title: 'Criar saque',
      description: `Cria um saque (cash out) para uma chave Pix. Saldo é debitado antes do envio. Se falhar, valor é estornado e status vira CANCELED. Doc: ${docBase}/endpoints/withdrawals/post_withdraw`,
      inputSchema: {
        amount: Amount,
        pixKey: z.string().min(1).describe('Chave Pix do destinatário (CPF, CNPJ, telefone 5511..., email, ou UUID/EVP).'),
        pixType: PixType,
        clientReference: z.string().min(1).max(64).describe('Identificador externo único e determinístico (ex: payout-123).'),
        callbackUrl: z.string().url().optional().describe('Opcional: URL HTTPS que recebe um POST quando o status muda. Se omitir, nenhum callback é enviado — consulte o status depois com a tool de consulta.'),
      },
    },
    async (args) => {
      try {
        const { data } = await http.post('/withdraw', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
  }

  server.registerTool(
    'withdraw_get',
    {
      title: 'Consultar saque',
      description: `Consulta um saque por id, clientReference OU endToEndId (use apenas um). Doc: ${docBase}/endpoints/withdrawals/get_withdraw`,
      inputSchema: {
        id: z.string().optional(),
        clientReference: z.string().optional(),
        endToEndId: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const params = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null));
        const { data } = await http.get('/withdraw', { params });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  if (enableCashOut) {
  server.registerTool(
    'withdraw_by_qr',
    {
      title: 'Pagar QR Code (saque)',
      description: `Paga um QR Code Pix dinâmico. Se o QR já trouxer valor embutido, amount pode ser omitido. Doc: ${docBase}/endpoints/withdrawals/post_withdraw_qrcode`,
      inputSchema: {
        qrCode: z.string().describe('Conteúdo do QR Code (copia-e-cola EMV) ou ID retornado por withdraw_read_qr.'),
        amount: Amount.optional().describe('Valor (só se o QR não embutir valor).'),
        clientReference: z.string().min(1).max(64),
        callbackUrl: z.string().url().optional().describe('Opcional: URL HTTPS que recebe um POST quando o status muda. Se omitir, nenhum callback é enviado — consulte o status depois com a tool de consulta.'),
      },
    },
    async (args) => {
      try {
        const { data } = await http.post('/withdraw/qrcode', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
  }

  server.registerTool(
    'withdraw_read_qr',
    {
      title: 'Ler QR Code',
      description: `Decodifica um QR Code Pix (formato EMV) e retorna recebedor, valor (se presente) e metadados. Use antes de withdraw_by_qr para confirmar com o usuário. Doc: ${docBase}/endpoints/withdrawals/post_pix_qrcode_read`,
      inputSchema: {
        qrCode: z.string().describe('Conteúdo bruto do QR Code copia-e-cola.'),
      },
    },
    async ({ qrCode }) => {
      try {
        const { data } = await http.post('/pix/qrcode/read', { emv: qrCode });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'withdraw_dict',
    {
      title: 'Consultar chave Pix (DICT)',
      description: `Consulta o DICT (diretório do Bacen) por chave Pix antes de pagar. Retorna nome do titular, banco, etc. Doc: ${docBase}/endpoints/withdrawals/get_pix_key`,
      inputSchema: {
        key: z.string().describe('Chave Pix a consultar (CPF, CNPJ, telefone 5511..., email, EVP).'),
      },
    },
    async ({ key }) => {
      try {
        const { data } = await http.get('/pix/key', { params: { pixKey: key } });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'withdraw_proof',
    {
      title: 'Comprovante de saque',
      description: `Retorna o comprovante de um saque em PDF base64 ou JSON. Doc: ${docBase}/endpoints/withdrawals/get_withdraw_proof`,
      inputSchema: {
        id: z.string().describe('ID do saque.'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/withdraw/proof/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
