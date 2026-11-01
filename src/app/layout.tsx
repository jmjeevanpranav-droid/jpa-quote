import type { Metadata } from 'next';
import './globals.css';
import { ClientSessionSync } from '@/components/ClientSessionSync';

export const metadata: Metadata = {
  title: 'JPA QUOTE',
  description:
    'Internal Quotation Builder with Persistent Product & Rate Memory, AI document reading, and deterministic GST calculations for Jeevan Pranav Agencies (JPA).',
  icons: {
    icon: '/jpa_favicon.svg',
    shortcut: '/jpa_favicon.svg',
    apple: '/jpa_favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body
        className="min-h-full flex flex-col font-sans bg-[#F8FAFF] text-slate-900"
        style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
      >
        <ClientSessionSync />
        {children}
      </body>
    </html>
  );
}
