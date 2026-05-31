'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Leaf, AlertCircle, Microscope, CalendarDays, Map, Truck, ShieldCheck, LineChart, Box } from 'lucide-react';
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
      {/* Left panel - branding with image background */}
      <div 
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-cover bg-center border-r border-slate-800/50"
        style={{ backgroundImage: "url('/bg-sima-arome.png')" }}
      >
        {/* Overlay to make text readable */}
        <div className="absolute inset-0 bg-slate-900/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1C] via-[#0A0F1C]/40 to-slate-900/40" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Box className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white shadow-sm">AromOS</span>
              <p className="text-blue-400 text-xs font-medium">Sima Arome</p>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4 drop-shadow-md">
            Platform Operasional<br />
            <span className="text-orange-400">Terpadu</span>
          </h1>
          <p className="text-slate-200 text-lg max-w-md drop-shadow">
            Solusi end-to-end manajemen rantai pasok ekstrak bahan alam. Optimalisasi produksi dari hulu ke hilir.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { icon: <Microscope className="w-5 h-5 text-orange-400" />, label: 'Quality Control', desc: 'Pemantauan mutu real-time' },
            { icon: <CalendarDays className="w-5 h-5 text-orange-400" />, label: 'PPIC & Penjadwalan', desc: 'Sinkronisasi rencana produksi' },
            { icon: <Map className="w-5 h-5 text-orange-400" />, label: 'Manajemen Gudang', desc: 'Pemetaan inventaris dinamis' },
            { icon: <Truck className="w-5 h-5 text-orange-400" />, label: 'Logistik & Distribusi', desc: 'Pelacakan armada terpusat' },
          ].map((item) => (
            <div key={item.label} className="bg-[#0A0F1C]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:bg-[#0A0F1C]/60 transition-colors">
              <div className="mb-2">{item.icon}</div>
              <div className="text-white font-semibold text-sm">{item.label}</div>
              <div className="text-slate-300 text-xs mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0B1120] relative">
        {/* Subtle Background Elements for the right side */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Box className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-white">AromOS</span>
              <p className="text-blue-400 text-xs font-medium">Sima Arome</p>
            </div>
          </div>

          <div className="bg-[#111827]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl">
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Masuk ke AromOS</h2>
              <p className="text-slate-400 text-sm">Masukkan kredensial akun Anda</p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="nama@simaarome.id"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm outline-none pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-sm shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Memproses...
                  </span>
                ) : 'Masuk ke Sistem'}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-8">
              <div className="relative flex items-center py-2 mb-4">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] uppercase tracking-widest text-slate-500">Akses Demo</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'admin', label: 'Admin', icon: <ShieldCheck className="w-4 h-4 text-slate-400" /> },
                  { role: 'qc', label: 'QC', icon: <Microscope className="w-4 h-4 text-slate-400" /> },
                  { role: 'ppic', label: 'PPIC', icon: <LineChart className="w-4 h-4 text-slate-400" /> },
                  { role: 'warehouse', label: 'Gudang', icon: <Box className="w-4 h-4 text-slate-400" /> },
                ].map(({ role, label, icon }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => fillDemo(role)}
                    className="flex items-center justify-center gap-2 text-xs py-2.5 px-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 text-slate-300 transition-all"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-slate-600 text-xs">
              &copy; 2024 Sima Arome Indonesia. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
