import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Settings, FileText, Layout, LogOut, 
  Download, Plus, Trash2, Edit2, Save, 
  ChevronRight, Search, Filter, MoreVertical, 
  Check, X, AlertTriangle, Image as ImageIcon,
  Loader2, Upload, Menu, UserPlus, Trophy
} from 'lucide-react';
import { auth, db, logout } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, getDocs, getDoc, addDoc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { Registration, FormField, WebConfig, PdfConfig } from '../types';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import IDCardPreview from '../components/IDCardPreview';
import { generateAndDownloadPDF } from '../lib/pdf-utils';

interface AdminDashboardProps {
  config: WebConfig;
}

export default function AdminDashboard({ config }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'form' | 'pdf' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'peserta' | 'pelatih'>('all');
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [selectedRegForPdf, setSelectedRegForPdf] = useState<Registration | null>(null);
  const [pdfConfigPeserta, setPdfConfigPeserta] = useState<PdfConfig | null>(null);
  const [pdfConfigPelatih, setPdfConfigPelatih] = useState<PdfConfig | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubRegs = onSnapshot(q, (snapshot) => {
      setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration)));
      setLoading(false);
    });

    const unsubFields = onSnapshot(query(collection(db, 'form_builder'), orderBy('order', 'asc')), (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField)));
    });

    const unsubConfigPeserta = onSnapshot(doc(db, 'settings', 'pdf_config'), (snapshot) => {
      if (snapshot.exists()) {
        setPdfConfigPeserta(snapshot.data() as PdfConfig);
      } else {
        setPdfConfigPeserta({
          backgroundUrl: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1000',
          paperSize: 'id_card',
          elements: {
            name: { x: 50, y: 100, fontSize: 24, visible: true },
            id: { x: 50, y: 150, fontSize: 16, visible: true },
            photo: { x: 350, y: 50, width: 100, height: 130, visible: true }
          }
        });
      }
    });

    const unsubConfigPelatih = onSnapshot(doc(db, 'settings', 'pdf_config_pelatih'), (snapshot) => {
      if (snapshot.exists()) {
        setPdfConfigPelatih(snapshot.data() as PdfConfig);
      } else {
        setPdfConfigPelatih({
          backgroundUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1000',
          paperSize: 'id_card',
          elements: {
            name: { x: 50, y: 100, fontSize: 24, visible: true },
            id: { x: 50, y: 150, fontSize: 16, visible: true },
            photo: { x: 350, y: 50, width: 100, height: 130, visible: true }
          }
        });
      }
    });

    return () => { unsubRegs(); unsubConfigPeserta(); unsubConfigPelatih(); unsubFields(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-rose-500" size={48} />
          <p className="text-slate-500 font-black italic tracking-tighter uppercase text-xs animate-pulse">Memuat Data...</p>
        </div>
      </div>
    );
  }

  const formatDate = (date: any) => {
    if (!date) return '-';
    try {
      // Handle Firestore Timestamp
      const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
      return format(d, 'yyyy-MM-dd HH:mm');
    } catch (e) {
      return String(date);
    }
  };

  const downloadRecap = () => {
    const headers = ['ID', 'Nama Lengkap', 'Tanggal Daftar'];
    const rows = registrations.map(reg => [
      reg.id,
      reg.fullName,
      formatDate(reg.createdAt)
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rekap_pendaftar_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteRegistration = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'HAPUS PENDAFTAR',
      message: 'Apakah anda yakin ingin menghapus data pendaftar ini? Tindakan ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'registrations', id));
        } catch (err) {
          console.error("Error deleting registration:", err);
        }
      }
    });
  };

  const handleUpdateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;
    try {
      const { id, ...data } = editingRegistration;
      await updateDoc(doc(db, 'registrations', id), data);
      setEditingRegistration(null);
    } catch (err) {
      alert('Gagal update data');
    }
  };

  const handleDeleteAll = (role: 'peserta' | 'pelatih' | 'all') => {
    const roleText = role === 'all' ? 'SEMUA DATA' : role.toUpperCase();
    setConfirmModal({
      isOpen: true,
      title: `HAPUS ${roleText}`,
      message: `Apakah anda yakin ingin menghapus ${roleText} pendaftar? Tindakan ini akan menghapus semua data secara permanen dan tidak dapat dibatalkan.`,
      onConfirm: async () => {
        try {
          const targetRegs = role === 'all' 
            ? registrations 
            : registrations.filter(r => r.type === role);
          
          for (const reg of targetRegs) {
            await deleteDoc(doc(db, 'registrations', reg.id));
          }
          alert(`Berhasil menghapus ${targetRegs.length} data.`);
        } catch (err) {
          console.error("Error deleting all registrations:", err);
          alert('Gagal menghapus data.');
        }
      }
    });
  };

  const handleDownloadAllPdf = async (role: 'peserta' | 'pelatih') => {
    const targetRegs = registrations.filter(r => r.type === role);
    if (targetRegs.length === 0) {
      alert(`Tidak ada data ${role} untuk diunduh.`);
      return;
    }

    const config = role === 'pelatih' ? pdfConfigPelatih : pdfConfigPeserta;
    
    setConfirmModal({
      isOpen: true,
      title: `UNDUH SEMUA PDF ${role.toUpperCase()}`,
      message: `Sistem akan mencoba mengunduh ${targetRegs.length} file PDF. Browser mungkin akan meminta izin untuk mengunduh banyak file. Lanjutkan?`,
      onConfirm: async () => {
        for (const reg of targetRegs) {
          await generateAndDownloadPDF('id-card-capture', reg, config?.paperSize);
          // Beri jeda sedikit agar browser tidak menganggap spam
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    });
  };

  const filteredRegistrations = registrations.filter(reg => 
    (reg.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    reg.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterRole === 'all' || reg.type === filterRole)
  );

  const handleExport = (role: 'peserta' | 'pelatih') => {
    const dataToExport = registrations
      .filter(r => r.type === role)
      .map(r => {
        const row: any = {
          'KODE ID': r.id,
          'TANGGAL DAFTAR': formatDate(r.createdAt),
          'NAMA LENGKAP': r.fullName
        };

        // Filter fields sesuai targetType
        const relevantFields = fields.filter(f => f.targetType === role || f.targetType === 'keduanya');
        
        relevantFields.forEach(field => {
          row[field.label] = r.customFields?.[field.id] || '-';
        });

        return row;
      });

    if (dataToExport.length === 0) {
      alert(`Tidak ada data ${role} untuk diexport.`);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, role === 'peserta' ? "Peserta" : "Pelatih");
    XLSX.writeFile(wb, `Data_${role === 'peserta' ? 'Peserta' : 'Pelatih'}_Evoka_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex overflow-hidden font-sans">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter text-rose-500 italic">EVOKA REGIST</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Admin Panel</p>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 py-6 overflow-y-auto custom-scrollbar">
          <SidebarItem 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
            icon={<Layout size={18} />} 
            label="Dashboard" 
          />
          <SidebarItem 
            active={activeTab === 'data'} 
            onClick={() => { setActiveTab('data'); setIsMobileMenuOpen(false); }} 
            icon={<Users size={18} />} 
            label="Data Pendaftar" 
          />
          <SidebarItem 
            active={activeTab === 'form'} 
            onClick={() => { setActiveTab('form'); setIsMobileMenuOpen(false); }} 
            icon={<Layout size={18} />} 
            label="Form Builder" 
          />
          <SidebarItem 
            active={activeTab === 'pdf'} 
            onClick={() => { setActiveTab('pdf'); setIsMobileMenuOpen(false); }} 
            icon={<FileText size={18} />} 
            label="Visual PDF Builder" 
          />
          <SidebarItem 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} 
            icon={<Settings size={18} />} 
            label="Web Settings" 
          />
        </nav>

        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all text-sm font-medium"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 md:h-20 bg-[#020617] border-b border-slate-800 flex items-center justify-between px-4 md:px-8 text-white shrink-0">
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            <button className="md:hidden text-slate-400 hover:text-white shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-xl md:text-3xl lg:text-4xl font-black italic tracking-tighter uppercase truncate">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'data' && 'Pendaftar'}
              {activeTab === 'form' && 'Form Builder'}
              {activeTab === 'pdf' && 'PDF Builder'}
              {activeTab === 'settings' && 'Settings'}
            </h2>
            <div className="hidden sm:block px-3 py-1 bg-slate-800 rounded text-[10px] font-bold tracking-widest text-slate-400 shrink-0">
              ACTIVE SESSION
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0 pl-2">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-bold text-white leading-none">{auth.currentUser?.displayName}</p>
               <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Administrator</p>
             </div>
             <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-rose-600 border-2 border-slate-800 overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
                {auth.currentUser?.photoURL ? <img src={auth.currentUser.photoURL} alt="User" /> : 'A'}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Main Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[32px] shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Users size={80} className="text-rose-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2 block">TOTAL PENDAFTAR</span>
                  <h3 className="text-6xl font-black italic tracking-tighter text-white">{registrations.length}</h3>
                  <div className="mt-4 flex gap-2">
                    <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded-full border border-rose-500/20 uppercase tracking-widest">Global Data</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[32px] shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <UserPlus size={80} className="text-blue-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2 block">TOTAL PESERTA</span>
                  <h3 className="text-6xl font-black italic tracking-tighter text-white">
                    {registrations.filter(r => r.type === 'peserta').length}
                  </h3>
                  <div className="mt-4 flex gap-2">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full border border-blue-500/20 uppercase tracking-widest italic">Atlet / Player</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[32px] shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Trophy size={80} className="text-amber-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2 block">TOTAL PELATIH</span>
                  <h3 className="text-6xl font-black italic tracking-tighter text-white">
                    {registrations.filter(r => r.type === 'pelatih').length}
                  </h3>
                  <div className="mt-4 flex gap-2">
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/20 uppercase tracking-widest italic">Official / Coach</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Recaps from Form Fields */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-800" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">DYNAMIC FIELD RECAPS</h4>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields
                    .filter(f => f.type === 'select' || f.type === 'text')
                    .map(field => {
                      // Calculate distribution
                      const counts: Record<string, number> = {};
                      registrations.forEach(reg => {
                        const rawVal = reg.customFields?.[field.id];
                        let val = 'TIDAK DIISI';
                        
                        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                          val = String(rawVal).toUpperCase();
                        }
                        
                        counts[val] = (counts[val] || 0) + 1;
                      });

                      const sortedValues = Object.entries(counts).sort((a, b) => b[1] - a[1]);

                      if (sortedValues.length === 0) return null;

                      return (
                        <div key={field.id} className="bg-slate-900/30 border border-slate-800/50 rounded-[32px] p-8 shadow-xl">
                          <div className="flex justify-between items-center mb-6">
                            <h5 className="text-sm font-black italic tracking-tighter text-rose-500 uppercase">{field.label}</h5>
                            <span className="text-[10px] font-bold text-slate-600 tracking-widest">{sortedValues.length} UNIQUE VALUES</span>
                          </div>
                          <div className="space-y-3">
                            {sortedValues.slice(0, 8).map(([val, count]) => (
                              <div key={val} className="flex items-center justify-between group">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[70%] group-hover:text-white transition-colors">{val}</span>
                                <div className="flex items-center gap-3 flex-1 ml-4">
                                  <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-rose-600/50 group-hover:bg-rose-600 transition-all" 
                                      style={{ width: `${registrations.length > 0 ? (count / registrations.length) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-black italic text-white min-w-[30px] text-right">{count}</span>
                                </div>
                              </div>
                            ))}
                            {sortedValues.length > 8 && (
                              <p className="text-[10px] font-bold text-slate-600 text-center mt-4 tracking-widest italic">+ {sortedValues.length - 8} VALUES LAINNYA</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
              <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between gap-4 md:gap-6">
                <div className="relative flex-1 w-full max-w-full sm:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="CARI NAMA ATAU KONTINGEN..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold tracking-wider focus:border-rose-500 outline-none uppercase text-white" 
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as any)}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white outline-none focus:border-rose-500 appearance-none uppercase"
                  >
                    <option value="all">SEMUA TIPE</option>
                    <option value="peserta">PESERTA</option>
                    <option value="pelatih">PELATIH</option>
                  </select>
                  
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {/* Export Excel Buttons */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleExport('peserta')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black italic tracking-tighter hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                      >
                        <Download size={14} /> EXPORT PESERTA
                      </button>
                      <button 
                        onClick={() => handleExport('pelatih')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black italic tracking-tighter hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20"
                      >
                        <Download size={14} /> EXPORT PELATIH
                      </button>
                    </div>

                    {/* Download PDF Buttons */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleDownloadAllPdf('peserta')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black italic tracking-tighter hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
                      >
                        <FileText size={14} /> PDF PESERTA
                      </button>
                      <button 
                        onClick={() => handleDownloadAllPdf('pelatih')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black italic tracking-tighter hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
                      >
                        <FileText size={14} /> PDF PELATIH
                      </button>
                    </div>

                    {/* Danger Zone */}
                    <button 
                      onClick={() => handleDeleteAll('all')}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-black italic tracking-tighter hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 size={14} /> HAPUS SEMUA
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-950 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-slate-800">
                      <th className="px-8 py-5 text-rose-500 min-w-[120px] text-center">KODE ID</th>
                      <th className="px-8 py-5 min-w-[200px] text-center">NAMA LENGKAP</th>
                      {fields.map(field => (
                        <th key={field.id} className="px-8 py-5 whitespace-nowrap text-center">{field.label}</th>
                      ))}
                      <th className="px-8 py-5 text-right sticky right-0 bg-slate-950 z-10 border-l border-slate-800 shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredRegistrations.map(reg => (
                      <tr key={reg.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-8 py-5 font-mono font-black text-rose-500 tracking-tighter italic text-center text-lg">{reg.id}</td>
                        <td className="px-8 py-5 font-bold uppercase tracking-tight text-center">{reg.fullName}</td>
                        {fields.map(field => (
                          <td key={field.id} className="px-8 py-5 whitespace-nowrap text-slate-400 font-medium text-center">
                            {reg.customFields?.[field.id] || '-'}
                          </td>
                        ))}
                        <td className="px-4 md:px-8 py-5 text-right sticky right-0 bg-slate-900 md:bg-slate-900/40 backdrop-blur-md group-hover:bg-slate-800/40 transition-colors z-10 border-l border-slate-800 md:border-l-0">
                          <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setSelectedRegForPdf(reg)}
                              className="p-2.5 bg-blue-600/10 md:bg-transparent border border-blue-500/20 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg transition-colors"
                              title="Unduh ID Card"
                            >
                              <FileText size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingRegistration(reg)}
                              className="p-2.5 bg-slate-800/50 md:bg-transparent border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRegistration(reg.id)}
                              className="p-2.5 bg-rose-600/10 md:bg-slate-950 border border-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all"
                              title="Hapus Data"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'form' && <FormBuilderTab />}
          {activeTab === 'pdf' && (
            <PdfBuilderTab 
              pdfConfigPeserta={pdfConfigPeserta} 
              setPdfConfigPeserta={setPdfConfigPeserta}
              pdfConfigPelatih={pdfConfigPelatih}
              setPdfConfigPelatih={setPdfConfigPelatih}
            />
          )}
          {activeTab === 'settings' && <SettingsTab config={config} />}
        </div>
      </main>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-10 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">KONFIRMASI AKSI</span>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white mt-2 mb-6">{confirmModal.title}</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-8">
                {confirmModal.message}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black italic tracking-tighter uppercase hover:bg-slate-700 transition-all"
                >
                  BATAL
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }}
                  className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
                >
                  YA, LANJUTKAN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Registration Modal */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar">
            <div className="p-6 md:p-10">
              <div className="flex justify-between items-start mb-8 md:mb-10">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">EDIT PLAYER</span>
                  <h3 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-white mt-1 md:mt-2">DATA PENDAFTAR</h3>
                </div>
                <button 
                  onClick={() => setEditingRegistration(null)}
                  className="p-3 bg-slate-800 border border-slate-700 rounded-full hover:bg-slate-700 text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateRegistration} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">NAMA LENGKAP</label>
                  <input 
                    type="text" 
                    value={editingRegistration.fullName}
                    onChange={e => setEditingRegistration({...editingRegistration, fullName: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white text-center"
                  />
                </div>

                {fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={editingRegistration.customFields?.[field.id] || ''}
                        onChange={e => setEditingRegistration({
                          ...editingRegistration, 
                          customFields: {
                            ...(editingRegistration.customFields || {}),
                            [field.id]: e.target.value
                          }
                        })}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white min-h-[100px]"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={editingRegistration.customFields?.[field.id] || ''}
                        onChange={e => setEditingRegistration({
                          ...editingRegistration, 
                          customFields: {
                            ...(editingRegistration.customFields || {}),
                            [field.id]: e.target.value
                          }
                        })}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white"
                      >
                        <option value="">Pilih Opsi</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type={field.type || 'text'}
                        value={editingRegistration.customFields?.[field.id] || ''}
                        onChange={e => setEditingRegistration({
                          ...editingRegistration, 
                          customFields: {
                            ...(editingRegistration.customFields || {}),
                            [field.id]: e.target.value
                          }
                        })}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white"
                      />
                    )}
                  </div>
                ))}

                <div className="pt-8 flex gap-4">
                   <button 
                    type="button"
                    onClick={() => setEditingRegistration(null)}
                    className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black italic tracking-tighter uppercase hover:bg-slate-700 transition-all"
                   >
                     BATAL
                   </button>
                   <button 
                    type="submit"
                    className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
                   >
                     SIMPAN PERUBAHAN
                   </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PDF Download Worker */}
      {selectedRegForPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/90 backdrop-blur-xl">
           <div className="bg-slate-900 border border-slate-800 rounded-[32px] md:rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar">
              <div className="p-6 md:p-10 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">PDF GENERATOR</span>
                <h3 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-white mt-1 md:mt-2 mb-6 md:mb-8">ID CARD PREVIEW</h3>
                
                <div className="mb-8 md:mb-10 scale-100 md:scale-110 origin-center flex justify-center">
                   <IDCardPreview registration={selectedRegForPdf} />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setSelectedRegForPdf(null)}
                    className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black italic tracking-tighter uppercase hover:bg-slate-700 transition-all font-bold"
                  >
                    BATAL
                  </button>
                  <button 
                    onClick={async () => {
                      const config = selectedRegForPdf.type === 'pelatih' ? pdfConfigPelatih : pdfConfigPeserta;
                      await generateAndDownloadPDF('id-card-capture', selectedRegForPdf, config?.paperSize);
                      setSelectedRegForPdf(null);
                    }}
                    className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                  >
                    <Download size={20} /> UNDUH PDF
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wide ${active ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      {icon} {label}
    </button>
  );
}

// Sub-components for tabs
function FormBuilderTab() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<Partial<FormField> | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const q = query(collection(db, 'form_builder'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField)));
    });
  }, []);

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField || !editingField.label) return;

    try {
      if (editingField.id) {
        const { id, ...data } = editingField;
        await updateDoc(doc(db, 'form_builder', id), data);
      } else {
        const newField = {
          ...editingField,
          order: fields.length,
          required: editingField.required ?? false,
          type: editingField.type ?? 'text'
        };
        await addDoc(collection(db, 'form_builder'), newField);
      }
      setEditingField(null);
    } catch (err) {
      alert('Gagal menyimpan field');
    }
  };

  const handleDeleteField = (id: string) => {
    if (!id) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'HAPUS FIELD',
      message: 'Apakah anda yakin ingin menghapus field ini? Data pendaftar yang sudah ada akan tetap tersimpan.',
      onConfirm: async () => {
        try {
          const fieldDocRef = doc(db, 'form_builder', id);
          await deleteDoc(fieldDocRef);
          
          // Non-blocking cleanup of PDF config
          const configRef = doc(db, 'settings', 'pdf_config');
          const snap = await getDoc(configRef);
          if (snap.exists()) {
            const config = snap.data() as PdfConfig;
            if (config.elements && config.elements[id]) {
              const newElements = { ...config.elements };
              delete newElements[id];
              await updateDoc(configRef, { elements: newElements });
            }
          }
        } catch (err) {
          console.error("Delete error:", err);
        }
      }
    });
  };

  const handleDeleteAllFields = () => {
    if (fields.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'HAPUS SEMUA FIELD',
      message: 'Apakah anda yakin ingin MENGHAPUS SEMUA FIELD? Ini akan mengosongkan formulir pendaftaran.',
      onConfirm: async () => {
        try {
          const promises = fields.map(field => deleteDoc(doc(db, 'form_builder', field.id)));
          await Promise.all(promises);
          
          const configRef = doc(db, 'settings', 'pdf_config');
          const snap = await getDoc(configRef);
          if (snap.exists()) {
            const config = snap.data() as PdfConfig;
            const newElements = { ...config.elements };
            fields.forEach(f => delete newElements[f.id]);
            await updateDoc(configRef, { elements: newElements });
          }
        } catch (err) {
          console.error("Error deleting all fields:", err);
        }
      }
    });
  };

  return (
    <div className="max-w-4xl space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500">CONFIGURATOR</span>
          <h3 className="font-black text-2xl md:text-3xl tracking-tighter italic uppercase text-white mt-1">Formulir Dinamis</h3>
          <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 leading-relaxed">Atur input tambahan yang dibutuhkan saat pendaftaran.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button 
            disabled={fields.length === 0}
            onClick={handleDeleteAllFields}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-rose-500/20 text-rose-500 font-black italic tracking-tighter uppercase hover:bg-rose-500/10 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> HAPUS SEMUA
          </button>
          <button 
            onClick={() => setEditingField({ label: '', type: 'text', required: false })}
            className="w-full sm:w-auto bg-rose-600 text-white px-8 py-4 rounded-2xl font-black italic tracking-tighter uppercase flex items-center justify-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
          >
            <Plus size={18} /> TAMBAH FIELD
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {fields.map(field => (
          <div key={field.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center justify-between shadow-sm hover:border-rose-500/30 transition-all group">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                 {field.type === 'text' && <FileText size={20} />}
                 {field.type === 'select' && <Layout size={20} />}
                 {field.type === 'number' && <div className="font-black italic">#</div>}
              </div>
              <div>
                <h4 className="font-black italic uppercase tracking-tight text-white">{field.label}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{field.type}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    field.targetType === 'peserta' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
                    field.targetType === 'pelatih' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                    'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    {field.targetType === 'keduanya' ? 'KEDUANYA' : field.targetType?.toUpperCase() || 'PESERTA'}
                  </span>
                  {field.required && <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 italic">WAJIB</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditingField(field)}
                className="p-4 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-white rounded-2xl transition-all"
              >
                <Edit2 size={16} />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteField(field.id);
                }}
                className="p-4 bg-slate-950 border border-slate-800 hover:bg-rose-600 text-rose-500 hover:text-white rounded-2xl transition-all cursor-pointer relative z-[60]"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/90 backdrop-blur-xl">
           <div className="bg-slate-900 border border-slate-800 rounded-[32px] md:rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar">
              <div className="p-6 md:p-10">
                <div className="flex justify-between items-start md:items-center mb-8 md:mb-10">
                  <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white">FIELD SETTINGS</h3>
                  <button onClick={() => setEditingField(null)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>
                <form onSubmit={handleSaveField} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LABEL INPUT</label>
                    <input 
                      required
                      type="text" 
                      value={editingField.label}
                      onChange={e => setEditingField({...editingField, label: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white"
                      placeholder="CONTOH: BERAT BADAN"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TIPE DATA</label>
                      <select 
                        value={editingField.type}
                        onChange={e => setEditingField({...editingField, type: e.target.value as any})}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white appearance-none"
                      >
                        <option value="text">TEXT</option>
                        <option value="number">NUMBER</option>
                        <option value="select">DROPDOWN</option>
                        <option value="date">DATE</option>
                        <option value="textarea">TEXTAREA</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TARGET FORMULIR</label>
                       <select 
                        value={editingField.targetType || 'peserta'}
                        onChange={e => setEditingField({...editingField, targetType: e.target.value as any})}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white appearance-none"
                      >
                        <option value="peserta">PESERTA SAJA</option>
                        <option value="pelatih">PELATIH SAJA</option>
                        <option value="keduanya">KEDUANYA</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WAJIB DIISI?</label>
                       <button 
                        type="button"
                        onClick={() => setEditingField({...editingField, required: !editingField.required})}
                        className={`w-full py-4 rounded-2xl font-black italic tracking-tighter uppercase transition-all border ${editingField.required ? 'bg-rose-500 border-rose-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                       >
                         {editingField.required ? 'YA' : 'TIDAK'}
                       </button>
                    </div>

                  {editingField.type === 'select' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OPSI (PISAH DENGAN KOMA)</label>
                      <textarea 
                        value={editingField.options?.join(', ')}
                        onChange={e => setEditingField({...editingField, options: e.target.value.split(',').map(s => s.trim())})}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase text-white h-32"
                        placeholder="OPSI A, OPSI B, OPSI C"
                      />
                    </div>
                  )}

                  <div className="pt-6 flex gap-4">
                    {editingField.id && (
                      <button 
                        type="button"
                        onClick={() => {
                          handleDeleteField(editingField.id!);
                          setEditingField(null);
                        }}
                        title="Hapus Field Ini"
                        className="flex-1 py-5 bg-slate-800 text-rose-500 rounded-2xl font-black italic tracking-tighter uppercase hover:bg-rose-500/10 transition-all border border-rose-500/20"
                      >
                        HAPUS FIELD
                      </button>
                    )}
                    <button type="submit" className="flex-1 py-5 bg-rose-600 text-white rounded-2xl font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20">
                      SIMPAN FIELD
                    </button>
                  </div>
                </form>
              </div>
           </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-10 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">KONFIRMASI AKSI</span>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white mt-2 mb-6">{confirmModal.title}</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-8">
                {confirmModal.message}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black italic tracking-tighter uppercase hover:bg-slate-700 transition-all"
                >
                  BATAL
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }}
                  className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black italic tracking-tighter uppercase hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
                >
                  YA, LANJUTKAN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PdfBuilderTab({ 
  pdfConfigPeserta, 
  setPdfConfigPeserta,
  pdfConfigPelatih,
  setPdfConfigPelatih 
}: { 
  pdfConfigPeserta: PdfConfig | null, 
  setPdfConfigPeserta: (config: PdfConfig) => void,
  pdfConfigPelatih: PdfConfig | null,
  setPdfConfigPelatih: (config: PdfConfig) => void
}) {
  const [activeRole, setActiveRole] = useState<'peserta' | 'pelatih'>('peserta');
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConfig = activeRole === 'peserta' ? pdfConfigPeserta : pdfConfigPelatih;
  const setCurrentConfig = activeRole === 'peserta' ? setPdfConfigPeserta : setPdfConfigPelatih;

  useEffect(() => {
    const unsubFields = onSnapshot(query(collection(db, 'form_builder'), orderBy('order', 'asc')), (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField)));
    });
    return () => { unsubFields(); };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (!currentConfig) return;
    e.preventDefault();
    const el = currentConfig.elements[id] as any;
    setDragging({
      id,
      startX: e.clientX - el.x,
      startY: e.clientY - el.y
    });
    setSelectedElement(id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !currentConfig) return;
      
      const newX = e.clientX - dragging.startX;
      const newY = e.clientY - dragging.startY;
      
      const newConfig = {
        ...currentConfig,
        elements: {
          ...currentConfig.elements,
          [dragging.id]: {
            ...currentConfig.elements[dragging.id],
            x: Math.round(newX),
            y: Math.round(newY)
          }
        }
      };
      setCurrentConfig(newConfig);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, currentConfig, setCurrentConfig]);

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentConfig) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentConfig({ ...currentConfig, backgroundUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePosition = async (element: string, key: string, value: any) => {
    if (!currentConfig) return;
    const newConfig = { 
      ...currentConfig,
      elements: {
        ...currentConfig.elements,
        [element]: {
          ...currentConfig.elements[element],
          [key]: value
        }
      }
    };
    setCurrentConfig(newConfig);
  };

  const handleSave = async () => {
    if (!currentConfig) return;
    
    // Check for large background image (Firestore limit is 1MB)
    if (currentConfig.backgroundUrl.startsWith('data:') && currentConfig.backgroundUrl.length > 800000) {
      alert('Ukuran gambar background terlalu besar. Silahkan gunakan gambar dengan ukuran di bawah 800KB atau gunakan URL gambar.');
      return;
    }

    setSaving(true);
    try {
      const docId = activeRole === 'peserta' ? 'pdf_config' : 'pdf_config_pelatih';
      await setDoc(doc(db, 'settings', docId), {
        ...currentConfig,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert(`Layout PDF ${activeRole.toUpperCase()} berhasil disimpan!`);
    } catch (error: any) {
      console.error("Error saving PDF layout:", error);
      alert(`Gagal menyimpan layout: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (fieldId: string) => {
    if (!currentConfig) return;
    const current = currentConfig.elements[fieldId];
    if (current) {
       const newElements = { ...currentConfig.elements };
       delete newElements[fieldId];
       setCurrentConfig({ ...currentConfig, elements: newElements });
    } else {
       setCurrentConfig({
         ...currentConfig,
         elements: {
           ...currentConfig.elements,
           [fieldId]: { x: 50, y: 200, fontSize: 14, visible: true }
         }
       });
    }
  };

  if (!currentConfig) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-rose-500" size={40} /></div>;

  const sortedElementKeys = Object.keys(currentConfig.elements).sort((a, b) => {
    const coreOrder = ['photo', 'name', 'id'];
    const idxA = coreOrder.indexOf(a);
    const idxB = coreOrder.indexOf(b);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    const fieldA = fields.find(f => f.id === a);
    const fieldB = fields.find(f => f.id === b);
    return (fieldA?.order || 0) - (fieldB?.order || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveRole('peserta')}
          className={`px-8 py-3 rounded-2xl font-black italic tracking-tighter uppercase transition-all ${activeRole === 'peserta' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
        >
          Visual Peserta
        </button>
        <button 
          onClick={() => setActiveRole('pelatih')}
          className={`px-8 py-3 rounded-2xl font-black italic tracking-tighter uppercase transition-all ${activeRole === 'pelatih' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
        >
          Visual Pelatih
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:h-full items-start">
        <div className="space-y-6">
           <div className="bg-slate-900 p-4 sm:p-10 rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] sm:min-h-[600px] bg-grid-slate-800/[0.1]">
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">LIVE PREVIEW ENGINE — {activeRole.toUpperCase()}</span>
              </div>
              
               <div 
                className={`relative bg-white border border-slate-700 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden rounded-lg transition-all duration-300 ${
                  dragging ? 'cursor-grabbing' : ''
                } ${
                  currentConfig.paperSize === 'b2' ? 'aspect-[500/707] w-[500px]' : 
                  currentConfig.paperSize === 'b3' ? 'aspect-[353/500] w-[500px]' : 
                  'aspect-[500/315] w-[500px]'
                }`}
                style={{ 
                  backgroundImage: `url(${currentConfig.backgroundUrl})`, 
                  backgroundSize: currentConfig.backgroundSize || 'cover', 
                  backgroundPosition: currentConfig.backgroundPosition || 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                 {sortedElementKeys.map((key) => {
                   const item = currentConfig.elements[key];
                   const el = item as { x: number; y: number; fontSize: number; color?: string; width?: number; height?: number };
                   const isDragging = dragging?.id === key;

                   if (key === 'photo') {
                     return (
                      <div 
                        key={key}
                        onMouseDown={(e) => handleMouseDown(e, key)}
                        className={`absolute border-2 border-dashed bg-slate-200/50 flex items-center justify-center transition-shadow cursor-move ${
                          isDragging ? 'z-50 shadow-2xl scale-105' : ''
                        } ${selectedElement === key ? 'border-rose-500 ring-4 ring-rose-500/20 opacity-100' : 'border-slate-400 opacity-50'}`}
                        style={{ 
                          left: el.x - (el.width || 0) / 2, 
                          top: el.y, 
                          width: el.width, 
                          height: el.height,
                        }}
                      >
                        <ImageIcon className="text-slate-500" />
                      </div>
                     );
                   }
                   return (
                    <div 
                      key={key}
                      onMouseDown={(e) => handleMouseDown(e, key)}
                      className={`absolute select-none cursor-move font-bold whitespace-nowrap px-2 -mx-2 transition-all border-2 border-transparent ${
                        isDragging ? 'z-50 scale-105 opacity-100' : ''
                      } ${selectedElement === key ? 'bg-rose-500/10 border-rose-500 ring-4 ring-rose-500/10' : 'border-dashed border-slate-300 hover:border-rose-500/50'}`}
                      style={{ 
                        left: el.x - 1000, 
                        width: 2000,
                        top: el.y, 
                        fontSize: el.fontSize, 
                        color: el.color || '#000000',
                        textAlign: 'center'
                      }}
                    >
                      {key === 'name' ? 'SAMPLE NAME' : key === 'id' ? 'SILAT-XXXXX' : fields.find(f => f.id === key)?.label || key}
                    </div>
                   );
                 })}
              </div>

              <div className="mt-12 flex gap-4">
                <button onClick={handleSave} disabled={saving} className="px-10 py-4 bg-rose-600 text-white rounded-2xl font-black italic tracking-tighter uppercase shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all flex items-center gap-2">
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> SAVE LAYOUT</>}
                </button>
              </div>
           </div>
        </div>
        
        <div className="space-y-6 lg:h-[calc(100vh-180px)] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
          {/* Layer Manager */}
          <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-6 sm:p-8 shadow-xl">
            <h3 className="text-sm font-black italic uppercase tracking-widest text-white mb-6 flex items-center gap-2">
              <Layout size={16} className="text-rose-500" /> LAYERS & ELEMENTS
            </h3>
            <div className="space-y-3">
               {['name', 'id', 'photo'].map(core => (
                 <button 
                  key={core}
                  onClick={() => setSelectedElement(core)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all ${selectedElement === core ? 'bg-rose-500 border-rose-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                 >
                   <span className="text-[10px] font-black uppercase tracking-widest">{core}</span>
                   <Edit2 size={12} className={selectedElement === core ? 'text-white' : 'text-slate-600'} />
                 </button>
               ))}
               <div className="pt-4 mt-4 border-t border-slate-800">
                 <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">DYNAMIC FIELDS ({activeRole.toUpperCase()})</p>
                 <div className="space-y-2">
                   {fields.filter(f => {
                     const target = f.targetType || 'peserta';
                     return target === activeRole || target === 'keduanya';
                   }).map(f => (
                     <div key={f.id} className="flex gap-2">
                       <button 
                        onClick={() => toggleField(f.id)}
                        className={`w-10 h-12 rounded-xl border flex items-center justify-center transition-all ${currentConfig.elements[f.id] ? 'bg-rose-600 border-rose-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-700'}`}
                       >
                         {currentConfig.elements[f.id] ? <Check size={16} /> : <Plus size={16} />}
                       </button>
                       <button 
                        onClick={() => setSelectedElement(f.id)}
                        disabled={!currentConfig.elements[f.id]}
                        className={`flex-1 flex items-center justify-between px-5 py-3 rounded-xl border transition-all ${selectedElement === f.id ? 'bg-rose-500 border-rose-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 disabled:opacity-30'}`}
                       >
                          <span className="text-[10px] font-black uppercase tracking-widest truncate">{f.label}</span>
                          {currentConfig.elements[f.id] && <Edit2 size={12} />}
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          {/* Global Settings */}
          <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-6 sm:p-8 shadow-xl">
            <h3 className="text-sm font-black italic uppercase tracking-widest text-white mb-6">GLOBAL SETTINGS</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PAPER SIZE</label>
                <select 
                   value={currentConfig.paperSize || 'id_card'}
                   onChange={e => setCurrentConfig({...currentConfig, paperSize: e.target.value as any})}
                   className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white outline-none focus:border-rose-500 appearance-none uppercase"
                >
                  <option value="id_card">ID CARD (LANDSCAPE)</option>
                  <option value="b2">B2 (PORTRAIT: 500x707mm)</option>
                  <option value="b3">B3 (PORTRAIT: 353x500mm)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BACKGROUND SETTINGS</label>
                <div className="grid grid-cols-2 gap-2">
                  <select 
                     value={currentConfig.backgroundSize || 'cover'}
                     onChange={e => setCurrentConfig({...currentConfig, backgroundSize: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white outline-none focus:border-rose-500 appearance-none uppercase"
                  >
                    <option value="cover">COVER (PENUH)</option>
                    <option value="contain">CONTAIN (FIT)</option>
                    <option value="100% 100%">100% STRETCH</option>
                    <option value="auto">AUTO</option>
                  </select>
                  <select 
                     value={currentConfig.backgroundPosition || 'center'}
                     onChange={e => setCurrentConfig({...currentConfig, backgroundPosition: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white outline-none focus:border-rose-500 appearance-none uppercase"
                  >
                    <option value="center">CENTER</option>
                    <option value="top">TOP</option>
                    <option value="bottom">BOTTOM</option>
                    <option value="left">LEFT</option>
                    <option value="right">RIGHT</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BACKGROUND URL / UPLOAD</label>
                <div className="flex gap-2">
                  <input 
                     value={currentConfig.backgroundUrl}
                     onChange={e => setCurrentConfig({...currentConfig, backgroundUrl: e.target.value})}
                     placeholder="https://..."
                     className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white outline-none focus:border-rose-500"
                  />
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBackgroundUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
                    title="Upload Background"
                  >
                    <Upload size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Element Editor */}
          {selectedElement && currentConfig.elements[selectedElement] && (() => {
            const el = currentConfig.elements[selectedElement] as any;
            return (
              <div className="bg-slate-900 rounded-[32px] border border-rose-500/30 p-8 shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">EDIT: {selectedElement}</h3>
                    <button onClick={() => setSelectedElement(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">POSITION X</label>
                        <span className="text-[10px] font-black text-rose-500">{el.x}px</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input 
                          type="range" min="0" max="1000" step="1"
                          value={el.x}
                          onChange={(e) => updatePosition(selectedElement, 'x', parseInt(e.target.value))}
                          className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                        />
                        <input 
                          type="number"
                          value={el.x}
                          onChange={(e) => updatePosition(selectedElement, 'x', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">POSITION Y</label>
                        <span className="text-[10px] font-black text-rose-500">{el.y}px</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input 
                          type="range" min="0" max="1000" step="1"
                          value={el.y}
                          onChange={(e) => updatePosition(selectedElement, 'y', parseInt(e.target.value))}
                          className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                        />
                        <input 
                          type="number"
                          value={el.y}
                          onChange={(e) => updatePosition(selectedElement, 'y', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {selectedElement !== 'photo' && (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FONT COLOR</label>
                          <span className="text-[10px] font-black text-rose-500 uppercase">{el.color || '#000000'}</span>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="color"
                            value={el.color || '#000000'}
                            onChange={(e) => updatePosition(selectedElement, 'color', e.target.value)}
                            className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer overflow-hidden p-0"
                          />
                          <input 
                            type="text"
                            value={el.color || '#000000'}
                            onChange={(e) => updatePosition(selectedElement, 'color', e.target.value)}
                            placeholder="#000000"
                            className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    )}

                    {selectedElement !== 'photo' ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FONT SIZE</label>
                          <span className="text-[10px] font-black text-rose-500">{el.fontSize}px</span>
                        </div>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="range" min="8" max="150" step="1"
                            value={el.fontSize}
                            onChange={(e) => updatePosition(selectedElement, 'fontSize', parseInt(e.target.value))}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                          <input 
                            type="number"
                            value={el.fontSize}
                            onChange={(e) => updatePosition(selectedElement, 'fontSize', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WIDTH</label>
                          <input 
                            type="number"
                            value={el.width}
                            onChange={(e) => updatePosition(selectedElement, 'width', parseInt(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HEIGHT</label>
                          <input 
                            type="number"
                            value={el.height}
                            onChange={(e) => updatePosition(selectedElement, 'height', parseInt(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ config }: { config: WebConfig }) {
  const [formData, setFormData] = useState<WebConfig>(config);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, 'settings', 'web_config'), { ...formData }, { merge: true });
    setSaving(false);
    alert('Pengaturan berhasil disimpan!');
  };

  return (
    <div className="max-w-2xl bg-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-800 shadow-2xl space-y-8 md:space-y-10">
      <div>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500">SYSTEM CORE</span>
        <h3 className="font-black text-3xl md:text-4xl italic tracking-tighter uppercase text-white mt-1">Pengaturan Web</h3>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Kontrol identitas dan status operasional sistem.</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">Nama Aplikasi</label>
          <input 
             value={formData.appName}
             onChange={e => setFormData({ ...formData, appName: e.target.value })}
             className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-black italic tracking-tight text-white uppercase"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">Warna Tema</label>
            <div className="flex gap-4">
              <input 
                type="color"
                value={formData.themeColor}
                onChange={e => setFormData({ ...formData, themeColor: e.target.value })}
                className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-slate-800 p-0 overflow-hidden bg-slate-950"
              />
              <input 
                value={formData.themeColor}
                onChange={e => setFormData({ ...formData, themeColor: e.target.value })}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-sm font-black text-rose-500 uppercase flex items-center justify-center text-center"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">Status Registrasi</label>
            <div className="flex items-center gap-4 h-16 bg-slate-950 border border-slate-800 rounded-2xl px-6">
               <button 
                onClick={() => setFormData({ ...formData, isOpen: !formData.isOpen })}
                className={`relative w-14 h-8 rounded-full transition-all duration-500 flex items-center px-1 ${formData.isOpen ? 'bg-rose-600' : 'bg-slate-800'}`}
               >
                 <div className={`w-6 h-6 rounded-full bg-white shadow-xl transition-transform duration-500 ${formData.isOpen ? 'translate-x-6' : 'translate-x-0'}`} />
               </button>
               <span className={`text-xs font-black uppercase tracking-widest ${formData.isOpen ? 'text-rose-500' : 'text-slate-500'}`}>
                 {formData.isOpen ? 'OPEN' : 'CLOSED'}
               </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-10 border-t border-slate-800">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-5 bg-rose-600 text-white rounded-3xl font-black italic tracking-tighter text-xl uppercase hover:bg-rose-500 transition-all disabled:opacity-50 shadow-2xl shadow-rose-600/20 flex items-center justify-center gap-3"
        >
          {saving ? <Loader2 className="animate-spin w-6 h-6" /> : <><Save size={24} /> SIMPAN PERUBAHAN</>}
        </button>
      </div>
    </div>
  );
}
