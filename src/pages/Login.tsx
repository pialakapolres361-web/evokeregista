import React, { useState } from 'react';
import { loginWithGoogle } from '../lib/firebase';
import { WebConfig } from '../types';
import { LogIn, Trophy, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  config: WebConfig;
}

export default function Login({ config }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      // On successful login, the App component will handle the state change
    } catch (err) {
      setError('Gagal masuk. Pastikan koneksi internet stabil.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-600"></div>
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-rose-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-rose-600/20">
              <Trophy size={32} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 mb-2 text-center">AUTHENTICATION</span>
            <h1 className="text-3xl font-black italic tracking-tighter text-white text-center uppercase">{config.appName}</h1>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-black italic tracking-tighter uppercase flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  SIGN IN WITH GOOGLE
                </>
              )}
            </button>
            <button
              onClick={() => { window.location.hash = '#/'; }}
              className="w-full py-2 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
            >
              Back to Public Portal
            </button>
          </div>

          {error && (
            <div className="mt-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500 text-xs font-bold uppercase tracking-wider">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
        
        <p className="text-center mt-10 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed">
          AUTHORIZATION REQUIRED. <br/> UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED.
        </p>
      </div>
    </div>
  );
}
