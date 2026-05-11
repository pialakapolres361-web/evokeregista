import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { doc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './lib/firebase';
import { WebConfig } from './types';
import PublicHome from './pages/PublicHome';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAdmin, loading } = useAuth();
  const [config, setConfig] = useState<WebConfig | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');

  useEffect(() => {
    // Migrate old pathname-based URLs to hash
    if (!window.location.hash && window.location.pathname === '/admin') {
      window.location.replace('/#/admin');
      return;
    }
    
    const handleHashChange = () => setCurrentPath(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    
    const unsubscribe = onSnapshot(doc(db, 'settings', 'web_config'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as WebConfig);
      } else {
        setConfig({
          appName: 'Evoka Regist',
          themeColor: '#1d4ed8',
          isOpen: true
        });
      }
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribe();
    };
  }, []);

  if (loading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (currentPath.startsWith('#/admin')) {
    if (!user) return <Login config={config} />;
    if (!isAdmin) return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center text-white">
        <h1 className="text-4xl font-black italic tracking-tighter text-rose-500 mb-4 uppercase">Akses Ditolak</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Email Anda tidak terdaftar sebagai Administrator:</p>
        <p className="text-white font-mono text-sm mb-8 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">{user.email}</p>
        <button 
          onClick={() => { window.location.hash = '#/'; }}
          className="px-8 py-3 bg-slate-900 border border-slate-800 rounded-xl font-black italic tracking-tighter uppercase text-xs hover:bg-slate-800 transition-all"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
    return <AdminDashboard config={config} />;
  }

  return <PublicHome config={config} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
