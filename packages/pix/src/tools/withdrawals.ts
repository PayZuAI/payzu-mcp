import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { ok, fail, docBase, registerCashOutUnavailable, toQuery } from '../utils.js';
import { CallbackUrl, VirtualAccount } from '../schemas.js';

const Amount = z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL). NUNCA em centavos.');
const PixType = z.enum(['cpf', 'cnpj', 'phone', 'email', 'evp']).describe('Tipo da chave Pix. evp é a chave aleatória.');
const Description = z.string().optional().describe('Descrição opcional do pagamento.');

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
      description: `Cria um saque (cash out) para uma chave Pix. Saldo é debitado antes do envio. Se falhar, valor é estornado e status vira CANCELED. Repetir o mesmo clientReference com mesmo valor e chave devolve o saque já criado; com dados diferentes é recusado. Doc: ${docBase}/endpoints/withdrawals/post_withdraw`,
      inputSchema: {
        amount: Amount,
        pixKey: z.string().min(1).describe('Chave Pix do destinatário no formato do pixType: CPF ou CNPJ só dígitos, telefone +55 com DDD (ex: +5511999998888), e-mail ou chave aleatória (EVP).'),
        pixType: PixType,
        clientReference: z.string().min(1).max(64).describe('Identificador externo único e determinístico (ex: payout-123).'),
        callbackUrl: CallbackUrl.optional(),
        description: Description,
        virtualAccount: VirtualAccount.optional(),
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
      description: `Consulta um saque por id, clientReference, endToEndId ou virtualAccount. Informe ao menos um; se informar mais de um, todos precisam bater no mesmo saque. Doc: ${docBase}/endpoints/withdrawals/get_withdraw`,
      inputSchema: {
        id: z.string().optional(),
        clientReference: z.string().max(64).optional(),
        endToEndId: z.string().optional(),
        virtualAccount: VirtualAccount.optional(),
      },
    },
    async (args) => {
      try {
        const { data } = await http.get('/withdraw', { params: toQuery(args) });
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
      description: `Paga um QR Code Pix estático ou dinâmico. Se o QR já trouxer valor embutido, amount pode ser omitido. Leia o QR antes com withdraw_read_qr e confirme recebedor e valor com o usuário. Doc: ${docBase}/endpoints/withdrawals/post_withdraw_qrcode`,
      inputSchema: {
        qrCode: z.string().min(1).describe('Conteúdo do QR Code Pix (copia-e-cola EMV).'),
        amount: z.number().min(0.1).multipleOf(0.01).optional().describe('Valor em REAIS decimais (BRL), mínimo 0.10. Só se o QR não embutir valor.'),
        clientReference: z.string().min(1).max(64),
        callbackUrl: CallbackUrl.optional(),
        description: Description,
        virtualAccount: VirtualAccount.optional(),
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
      description: `Decodifica um QR Code Pix (formato EMV, estático ou dinâmico) e retorna recebedor, valor (se presente) e metadados. Use antes de withdraw_by_qr para confirmar com o usuário. Doc: ${docBase}/endpoints/keys-and-dict/post_pix_qrcode_read`,
      inputSchema: {
        qrCode: z.string().min(1).describe('Conteúdo bruto do QR Code copia-e-cola.'),
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
      description: `Consulta o DICT (diretório do Bacen) por chave Pix de terceiro antes de pagar. Retorna nome e documento do titular, agência, conta e instituição. Aceita token com permissão DEPOSIT ou WITHDRAW. Doc: ${docBase}/endpoints/keys-and-dict/get_pix_key`,
      inputSchema: {
        key: z.string().min(1).max(77).describe('Chave Pix a consultar: CPF, CNPJ, telefone +55 com DDD, e-mail ou EVP.'),
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
      description: `Retorna o comprovante de um saque em PDF, como data URI base64 no campo base64. Doc: ${docBase}/endpoints/withdrawals/get_withdraw_proof`,
      inputSchema: {
        id: z.string().min(1).describe('ID do saque.'),
      },
    },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/withdraw/proof/${id}`, { params: { type: 'base64' } });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
