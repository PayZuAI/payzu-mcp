import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  PAYZU_TOKEN: str({
    desc: 'Bearer token from the PayZu dashboard (web.payzu.processamento.com -> Credentials)',
  }),
  PAYZU_API_URL: url({
    default: 'https://api.payzu.processamento.com/v1',
    desc: 'Base URL of the Pix Processamento API. Override for whitelabel tenants (api.<slug>.processamento.com/v1).',
  }),
});
