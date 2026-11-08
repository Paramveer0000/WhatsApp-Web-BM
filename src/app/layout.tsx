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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('app_theme') || 'night';
                document.documentElement.setAttribute('data-theme', theme);
                if (theme === 'day') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('day');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('day');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        <ClientSafetyProvider>
          {children}
        </ClientSafetyProvider>
      </body>
    </html>
  );
}
