// STRAYMUTANT.DEV — Tamak Bookshop
// The tracking page is a client component, so its title lives here.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}