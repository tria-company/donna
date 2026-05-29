import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const locales = ['en', 'de', 'it', 'zh', 'ja', 'pt', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];

// Donna fork: PT-BR as the default locale for the internal-tool deployment.
export const defaultLocale: Locale = 'pt';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale: locale as string,
    messages: (await import(`../../translations/${locale}.json`)).default
  };
});

