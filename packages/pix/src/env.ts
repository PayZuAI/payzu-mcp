import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  PAYZU_TOKEN: str({
    desc: 'Bearer token from the PayZu dashboard (web.payzu.com.br/developers/credentials)',
  }),
  PAYZU_API_URL: url({
    default: 'https://api.pix.payzu.com.br/v1',
    desc: 'Base URL of the Pix Processamento API',
  }),
});
