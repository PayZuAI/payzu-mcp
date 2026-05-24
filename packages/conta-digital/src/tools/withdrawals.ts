import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

const Amount = z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL).');
const PixType = z.enum(['cpf', 'cnpj', 'phone', 'email', 'evp']);

export function registerWithdrawalsTools(server: McpServer) {
  server.tool(
    'withdraw.by_pix_key',
    `Saque por chave Pix (CPF, CNPJ, telefone, email, EVP). Saldo é debitado antes do envio; se falhar, valor é estornado e status vira CANCELED. Doc: ${docBase}/saques/createWithdraw`,
    {
      amount: Amount,
      pixKey: z.string().min(1),
      pixType: PixType,
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url(),
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

  server.tool(
    'withdraw.by_bank_data',
    `Envia Pix usando dados bancários completos (sem chave Pix). Suporta bancos tradicionais e instituições de pagamento. Doc: ${docBase}/saques/createWithdrawBankData`,
    {
      amount: Amount,
      bank: z.string().describe('Código do banco (3 dígitos).'),
      branch: z.string().describe('Agência.'),
      account: z.string().describe('Conta com dígito.'),
      document: z.string().describe('CPF ou CNPJ do titular.'),
      name: z.string(),
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url(),
    },
    async (args) => {
      try {
        const { data } = await http.post('/withdraw/bank-data', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'withdraw.ted',
    `Envia dinheiro via TED (Transferência Eletrônica Disponível). Processamento em até 1 dia útil. Doc: ${docBase}/saques/createWithdrawTed`,
    {
      amount: Amount,
      bank: z.string(),
      branch: z.string(),
      account: z.string(),
      document: z.string(),
      name: z.string(),
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url(),
    },
    async (args) => {
      try {
        const { data } = await http.post('/ted', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'withdraw.by_qr',
    `Paga QR Code Pix dinâmico. Se QR embute valor, amount pode ser omitido. Doc: ${docBase}/saques/createWithdrawQrCode`,
    {
      qrCode: z.string().describe('Conteúdo do QR Code copia-e-cola (EMV).'),
      amount: Amount.optional(),
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url(),
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

  server.tool(
    'withdraw.internal_transfer',
    `Transfere instantaneamente entre contas PayZu (taxa reduzida, processamento imediato). Doc: ${docBase}/saques/createInternalTransfer`,
    {
      amount: Amount,
      targetEmail: z.string().email().describe('Email da conta PayZu destino.'),
      clientReference: z.string().min(1).max(64),
      callbackUrl: z.string().url().optional(),
    },
    async (args) => {
      try {
        const { data } = await http.post('/internal-transfer', args);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'withdraw.proof',
    `Baixa comprovante oficial de um saque. Doc: ${docBase}/saques/getTransactionProof`,
    { id: z.string() },
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
