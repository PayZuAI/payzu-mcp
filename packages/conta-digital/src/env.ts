import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  PAYZU_TOKEN: str({
    desc: 'Bearer token from https://abrirconta.payzu.com.br dashboard',
  }),
  PAYZU_HUB_API_URL: url({
    default: 'https://pix.payzu.io/v1',
    desc: 'Base URL of the Conta Digital API.',
  }),
});
