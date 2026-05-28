import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AromOS — Sima Arome Operations System',
  description: 'Integrated Operations System untuk Sima Arome — manajemen rantai produksi ekstrak alam Indonesia.',
  keywords: 'aromOS, sima arome, produksi, ekstrak, QC, PPIC, warehouse',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.variable} font-sans bg-[#0A0F1C] text-slate-100 antialiased`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1E293B',
                color: '#F1F5F9',
                border: '1px solid #334155',
                borderRadius: '10px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#22C55E', secondary: '#1E293B' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#1E293B' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
