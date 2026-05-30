import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'AromOS — Sima Arome Operations System',
  description: 'Integrated Operations System untuk Sima Arome — manajemen rantai produksi ekstrak alam Indonesia.',
  keywords: 'aromOS, sima arome, produksi, ekstrak, QC, PPIC, warehouse',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-outfit bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white/90 antialiased`}>
        <ThemeProvider>
          <SidebarProvider>
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
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
