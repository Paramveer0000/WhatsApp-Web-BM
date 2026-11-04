import type { Metadata } from 'next';
import './globals.css';
import ClientSafetyProvider from '@/components/ClientSafetyProvider';

export const metadata: Metadata = {
  title: 'WhatsApp Campaign Manager - Evolution API v2',
  description: 'Self-hosted, enterprise WhatsApp bulk campaign manager powered by Evolution API v2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        <ClientSafetyProvider>
          {children}
        </ClientSafetyProvider>
      </body>
    </html>
  );
}
