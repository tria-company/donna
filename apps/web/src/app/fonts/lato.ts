// Donna fork: Lato is the brand body font (next/font/google self-hosted).
import { Lato } from 'next/font/google';

export const lato = Lato({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700', '900'],
  variable: '--font-lato',
  display: 'swap',
});
