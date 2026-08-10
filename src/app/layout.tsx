import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - Private Personal Gallery & Vault`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  keywords: ['MegaVault', 'Media Vault', 'Encrypted Gallery', 'Private Cloud', 'MEGA Index'],
  authors: [{ name: 'MegaVault Team' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/x-icon' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: `${APP_NAME} - Private Media Vault & Index`,
    description: APP_TAGLINE,
    url: 'https://megavault.app',
    siteName: APP_NAME,
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MegaVault Brand Identity & Vault Showcase',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} - Private Personal Media Vault`,
    description: APP_TAGLINE,
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
