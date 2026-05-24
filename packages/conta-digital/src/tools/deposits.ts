import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '../client.js';
import { ok, fail, docBase } from '../utils.js';

const Amount = z.number().positive().multipleOf(0.01).describe('Valor em REAIS decimais (BRL). NUNCA em centavos.');

export function registerDepositsTools(server: McpServer) {
  server.tool(
    'deposits.create_pix',
    `Cria cobrança Pix dinâmica (entrada de dinheiro). Retorna QR Code + ID. Doc: ${docBase}/depositos/createPixCharge`,
    {
      amount: Amount,
      clientReference: z.string().min(1).max(64).describe('Identificador externo único e determinístico.'),
      callbackUrl: z.string().url(),
      generatedName: z.string().optional(),
      generatedDocument: z.string().optional(),
      generatedEmail: z.string().email().optional(),
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

  server.tool(
    'deposits.get_pix',
    `Consulta status e detalhes de uma cobrança Pix por id. Doc: ${docBase}/depositos/getPixTransaction`,
    { id: z.string() },
    async ({ id }) => {
      try {
        const { data } = await http.get(`/pix/${id}`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'deposits.proof',
    `Baixa comprovante oficial de uma transação Pix (PDF base64 ou JSON estruturado). Doc: ${docBase}/depositos/getTransactionProof`,
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

  server.tool(
    'deposits.refund',
    `Estorna valor recebido via Pix. Processado instantaneamente para conta de origem. CUIDADO: ação irreversível, valida com humano antes. Doc: ${docBase}/depositos/refundPixTransaction`,
    {
      id: z.string().describe('ID da transação Pix a estornar.'),
      amount: Amount.optional().describe('Valor parcial em REAIS (opcional, default = valor total).'),
    },
    async ({ id, amount }) => {
      try {
        const body = amount != null ? { amount } : {};
        const { data } = await http.post(`/pix/refund/${id}`, body);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
