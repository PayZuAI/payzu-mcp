import { z } from 'zod';

export const TX_STATUS = ['PENDING', 'COMPLETED', 'CANCELED', 'WAITING_FOR_REFUND', 'REFUNDED', 'EXPIRED', 'ERROR'] as const;

export const TX_TYPE = ['DEPOSIT', 'WITHDRAW', 'COMMISSION', 'LIQUIDATION', 'ADJUSTMENT'] as const;

export const WEBHOOK_EVENTS = [
  'TRANSACTION_PENDING',
  'TRANSACTION_COMPLETED',
  'TRANSACTION_CANCELED',
  'TRANSACTION_WAITING_FOR_REFUND',
  'TRANSACTION_REFUNDED',
  'TRANSACTION_EXPIRED',
  'TRANSACTION_ERROR',
  'TRANSACTION_SUSPECTED_FRAUD',
  'TRANSACTION_SUSPECTED_FRAUD_REVERSAL',
  'INFRACTION_CHANGED',
] as const;

export const TxStatus = z.enum(TX_STATUS);

export const TxType = z.enum(TX_TYPE);

export const WebhookEvent = z.enum(WEBHOOK_EVENTS);

export const SortDirection = z.enum(['asc', 'desc']).describe('desc (padrão) traz o mais recente primeiro.');

export const Page = z.number().int().min(1).describe('Página, começa em 1.');

export const Limit = z.number().int().min(1).max(100).describe('Itens por página (máx 100).');

export const Document = z.string().regex(/^\d{11,14}$/).describe('CPF (11) ou CNPJ (14), só dígitos.');

export const VirtualAccount = z
  .string()
  .min(1)
  .max(50)
  .describe('Subconta virtual (até 50 caracteres) para separar lojas, filiais ou marketplaces. Volta no callback.');

export const CallbackUrl = z
  .string()
  .url()
  .regex(/^https?:\/\//)
  .describe('Opcional: URL http(s) que recebe um POST quando o status muda. Se omitir, nenhum callback é enviado; consulte o status depois com a tool de consulta.');
