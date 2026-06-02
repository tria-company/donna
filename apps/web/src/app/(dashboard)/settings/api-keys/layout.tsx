import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Donna',
  description: 'Manage your API keys for programmatic access to Donna',
  openGraph: {
    title: 'API Keys | Donna',
    description: 'Manage your API keys for programmatic access to Donna',
    type: 'website',
  },
};

export default async function APIKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
