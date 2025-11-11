import ShopifyFormat from '@shopify/i18next-shopify';
import FsBackend from 'i18next-fs-backend';
import HttpBackend from 'i18next-http-backend';
import {resolve} from 'node:path';
import {RemixI18Next} from 'remix-i18next/server';

import i18nextOptions from './i18nextOptions';

const isProd = (process.env.NODE_ENV === 'production') || Boolean(process.env.VERCEL);
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
const baseUrl = (process.env.SHOPIFY_APP_URL || vercelUrl).replace(/\/$/, '');
const useHttp = isProd && Boolean(baseUrl);
const backendPlugin = useHttp ? (HttpBackend as any) : (FsBackend as any);
const loadPath = useHttp
  ? `${baseUrl}/locales/{{lng}}/{{ns}}.json`
  : resolve('./public/locales/{{lng}}/{{ns}}.json');

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18nextOptions.supportedLngs,
    fallbackLanguage: i18nextOptions.fallbackLng,
    searchParamKey: 'locale',
    order: ['searchParams'],
  },
  i18next: {
    ...i18nextOptions,
    backend: {
      loadPath,
    },
  },
  plugins: [backendPlugin, ShopifyFormat.default ?? ShopifyFormat],
});

export default i18next;
