import React, { useState, useEffect } from 'react';
import { Search, Trophy, UserPlus, Download, Loader2, AlertCircle, ChevronRight, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Registration, WebConfig, FormField } from '../types';
import RegistrationForm from '../components/RegistrationForm';
import IDCardPreview from '../components/IDCardPreview';
import { motion, AnimatePresence } from 'motion/react';
import { generateAndDownloadPDF } from '../lib/pdf-utils';

interface PublicHomeProps {
  config: WebConfig;
}

export default function PublicHome({ config }: PublicHomeProps) {
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundRegistration, setFoundRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'peserta' | 'pelatih' | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setSearching(true);
    setError('');
    try {
      const docRef = doc(db, 'registrations', searchId.trim().toUpperCase());
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        setFoundRegistration({ id: snapshot.id, ...snapshot.data() } as Registration);
      } else {
        setError('DATA TIDAK DITEMUKAN.');
      }
    } catch (err) {
      setError('KESALAHAN SISTEM.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Header */}
      <header className="bg-[#020617] border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tighter text-rose-500 italic">EVOKA REGIST</h1>
          </div>
          <button 
            onClick={() => window.location.hash = '#/admin'}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors"
          >
            Admin Panel
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* Welcome Section */}
        <section className="text-center mb-20">
          <h2 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter italic leading-[0.9] text-white">
            JOIN THE <span className="text-rose-500">ARENA</span>
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto font-bold uppercase tracking-widest text-xs">
            SISTEM REGRESTRASI STANDALONE BERPERFORMA TINGGI UNTUK EVENT SILAT PROFESIONAL.
          </p>
        </section>

        {/* Action Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* Search Box */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Search className="w-5 h-5 text-rose-500" />
                <h3 className="font-black italic tracking-tighter text-xl uppercase">CEK STATUS</h3>
              </div>
              <form onSubmit={handleSearch} className="space-y-4">
                <input
                  type="text"
                  placeholder="KODE PENDAFTARAN"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-black italic tracking-widest text-sm uppercase placeholder:text-slate-700 transition-all"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-4 rounded-2xl font-black italic tracking-tighter text-white transition-all hover:bg-rose-500 bg-rose-600 shadow-lg shadow-rose-600/20 uppercase"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CARI SEKARANG'}
                </button>
              </form>
              {error && (
                <div className="mt-4 text-rose-500 text-[10px] font-black tracking-widest flex items-center gap-2 uppercase">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Register Button */}
          <div 
            className={`bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col justify-between transition-all ${config.isOpen ? 'cursor-pointer group hover:border-rose-500/50' : 'opacity-50 grayscale cursor-not-allowed'}`}
            onClick={() => config.isOpen && setShowForm(true)}
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <UserPlus className={`w-6 h-6 ${config.isOpen ? 'text-rose-500' : 'text-slate-500'}`} />
                <h3 className="font-black italic tracking-tighter text-xl uppercase">REGISTRASI</h3>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                {config.isOpen 
                  ? 'MULAI LANGKAH ANDA UNTUK MENJADI JUARA. DAFTARKAN DIRI SEKARANG.'
                  : 'PENDAFTARAN SEDANG DITUTUP. SILAHKAN HUBUNGI ADMIN UNTUK INFO LEBIH LANJUT.'}
              </p>
            </div>
            {config.isOpen && (
              <div className="mt-8 flex items-center gap-3 font-black text-rose-500 italic tracking-tighter transition-transform group-hover:translate-x-2">
                BUKA FORMULIR <ChevronRight className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>

        {/* Found Registration Modal Detail */}
        <AnimatePresence>
          {foundRegistration && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md"
              onClick={() => setFoundRegistration(null)}
            >
              <div 
                className="bg-slate-900 border border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.1)]"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-10">
                  <div className="flex justify-between items-start mb-10">
                    <div className="max-w-[70%]">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">
                        {foundRegistration.type === 'pelatih' ? 'KARTU PELATIH' : 'KARTU PESERTA'}
                      </span>
                      <h4 className="text-4xl font-black italic tracking-tighter uppercase leading-none mt-2 text-white">{foundRegistration.fullName}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-xs font-mono font-black text-rose-500 italic tracking-tighter">
                      {foundRegistration.id}
                    </div>
                  </div>

                  <div className="space-y-4 mb-10 border-y border-slate-800 py-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">KONTINGEN</span>
                      <span className="font-black uppercase italic tracking-tighter text-white">{foundRegistration.contingent}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">KATEGORI</span>
                      <span className="font-black uppercase italic tracking-tighter text-rose-500">{foundRegistration.category}</span>
                    </div>
                  </div>

                  <IDCardPreview registration={foundRegistration} />

                  <div className="mt-10 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="py-4 rounded-2xl bg-slate-800 text-white font-black italic tracking-tighter uppercase hover:bg-slate-700 transition-all border border-slate-700"
                      >
                        UBAH DATA
                      </button>
                      <button 
                        onClick={() => generateAndDownloadPDF('id-card-capture', foundRegistration!)}
                        className="py-4 rounded-2xl bg-rose-600 text-white font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" /> UNDUH PDF
                      </button>
                    </div>
                    <button 
                      onClick={() => setFoundRegistration(null)}
                      className="py-4 rounded-2xl bg-slate-950 text-slate-500 font-black italic tracking-tighter uppercase hover:text-white transition-all text-xs"
                    >
                      TUTUP
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Form Modal */}
        <AnimatePresence>
          {isEditing && foundRegistration && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-[60] bg-[#020617] overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto px-6 py-16">
                <div className="flex items-center justify-between mb-16">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500">UPDATE DATA</span>
                    <h2 className="text-6xl font-black italic tracking-tighter text-white uppercase mt-2">EDIT INFO</h2>
                  </div>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="p-4 bg-slate-900 border border-slate-800 text-white rounded-full hover:bg-slate-800 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                <RegistrationForm 
                  config={config} 
                  initialRegistration={foundRegistration}
                  onSuccess={(reg) => {
                    setIsEditing(false);
                    setFoundRegistration(reg);
                    // Force refresh to update the detail view
                  }} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registration Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#020617] overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto px-6 py-16">
                {!selectedRole ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center">
                    <div className="flex justify-between items-center w-full mb-16">
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500">SELECT TYPE</span>
                        <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase mt-2">PILIH TIPE</h2>
                      </div>
                      <button 
                        onClick={() => setShowForm(false)}
                        className="p-4 bg-slate-900 border border-slate-800 text-white rounded-full hover:bg-slate-800 transition-all"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 w-full">
                      <div 
                        onClick={() => setSelectedRole('peserta')}
                        className="bg-slate-900 border-2 border-slate-800 p-10 rounded-[40px] cursor-pointer group hover:border-rose-500 transition-all text-center flex flex-col items-center gap-6"
                      >
                        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                          <UserPlus size={40} />
                        </div>
                        <div>
                          <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white mb-2">PESERTA</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">PENDAFTARAN ATLET / PESERTA EVENT</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setSelectedRole('pelatih')}
                        className="bg-slate-900 border-2 border-slate-800 p-10 rounded-[40px] cursor-pointer group hover:border-amber-500 transition-all text-center flex flex-col items-center gap-6"
                      >
                        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all">
                          <Trophy size={40} />
                        </div>
                        <div>
                          <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white mb-2">PELATIH</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">PENDAFTARAN OFFICIAL / PELATIH KONTINGEN</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-16">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500">ENTRY FORM — {selectedRole.toUpperCase()}</span>
                        <h2 className="text-6xl font-black italic tracking-tighter text-white uppercase mt-2">REGISTRASI</h2>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setSelectedRole(null)}
                          className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 font-black italic tracking-tighter uppercase rounded-2xl hover:text-white transition-all text-xs"
                        >
                          KEMBALI
                        </button>
                        <button 
                          onClick={() => {
                            setShowForm(false);
                            setSelectedRole(null);
                          }}
                          className="p-4 bg-slate-900 border border-slate-800 text-white rounded-full hover:bg-slate-800 transition-all"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>
                    <RegistrationForm 
                      config={config} 
                      type={selectedRole}
                      onSuccess={(reg) => {
                        setShowForm(false);
                        setSelectedRole(null);
                        setFoundRegistration(reg);
                      }} 
                    />
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-20 border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            © 2026 {config.appName} — PROFESSIONAL PORTAL
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <span>HIGH PERFORMANCE</span>
            <span>HYBRID PDF ENGINE</span>
            <span>SECURE FIREBASE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
