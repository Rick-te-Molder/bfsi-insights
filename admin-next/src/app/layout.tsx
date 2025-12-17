import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StatusProvider } from '@/contexts/StatusContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BFSI Admin',
  description: 'Admin control tower for BFSI Insights',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-neutral-950 text-neutral-100`}>
        <StatusProvider>{children}</StatusProvider>
      </body>
    </html>
  );
}
