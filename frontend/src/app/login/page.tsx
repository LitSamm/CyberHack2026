'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Leaf, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Selamat datang kembali!');
    } catch (err: any) {
      const msg = err?.message || 'Login gagal. Periksa email dan password.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    const accounts: Record<string, { email: string; password: string }> = {
      admin: { email: 'budi.admin@simaarome.id', password: 'Admin@123' },
      qc: { email: 'siti.qc@simaarome.id', password: 'Qc@12345' },
      ppic: { email: 'fajar.ppic@simaarome.id', password: 'Ppic@123' },
      warehouse: { email: 'teguh.wh@simaarome.id', password: 'Wh@12345' },
    };
    setEmail(accounts[role].email);
    setPassword(accounts[role].password);
  };

  return (
    <div className="min-h-screen flex bg-[#0A0F1C]">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-orange-950 via-[#0F172A] to-blue-950 p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-orange-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">AromOS</span>
              <p className="text-orange-400 text-xs">by Sima Arome</p>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Sistem Operasi<br />
            <span className="text-orange-400">Terintegrasi</span><br />
            Sima Arome
          </h1>
          <p className="text-slate-300 text-lg">
            Kelola rantai produksi ekstrak alam Indonesia — dari penerimaan bahan baku hingga pengiriman produk jadi.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { icon: '🔬', label: 'Quality Control', desc: 'Pemeriksaan lot real-time' },
            { icon: '📅', label: 'PPIC Scheduling', desc: 'Kanban & kalender produksi' },
            { icon: '🏪', label: 'Warehouse Map', desc: 'Peta gudang interaktif' },
            { icon: '🚚', label: 'Dispatch', desc: 'Tracking pengiriman' },
          ].map((item) => (
            <div key={item.label} className="glass-card p-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-white font-semibold text-sm">{item.label}</div>
              <div className="text-slate-400 text-xs">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">AromOS</span>
          </div>

          <div className="glass-card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Masuk ke AromOS</h2>
              <p className="text-slate-400 text-sm">Masukkan kredensial akun Anda</p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="nama@simaarome.id"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Masuk...
                  </span>
                ) : 'Masuk'}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 pt-5 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-3 text-center">Demo akun — klik untuk mengisi otomatis</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'admin', label: 'Admin', color: 'text-purple-400' },
                  { role: 'qc', label: 'QC Officer', color: 'text-green-400' },
                  { role: 'ppic', label: 'PPIC', color: 'text-blue-400' },
                  { role: 'warehouse', label: 'Warehouse', color: 'text-yellow-400' },
                ].map(({ role, label, color }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => fillDemo(role)}
                    className={`text-xs py-2 px-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-500 ${color} transition-colors text-left`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            © 2024 Sima Arome Indonesia. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
