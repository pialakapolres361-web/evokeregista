import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FormField, WebConfig, Registration } from '../types';
import { Loader2, Camera, Upload, AlertCircle } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface RegistrationFormProps {
  config: WebConfig;
  type?: 'peserta' | 'pelatih';
  onSuccess: (reg: Registration) => void;
  initialRegistration?: Registration;
}

export default function RegistrationForm({ config, type, onSuccess, initialRegistration }: RegistrationFormProps) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialRegistration?.photoUrl || null);

  useEffect(() => {
    const q = query(collection(db, 'form_builder'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fieldData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField));
      
      // Filter fields based on targetType
      const filteredFields = fieldData.filter(f => {
        const target = f.targetType || 'peserta';
        if (!type || target === 'keduanya') return true;
        return target === type;
      });

      setFields(filteredFields);
      
      // Initialize form data if editing
      if (initialRegistration) {
        setFormData({
          fullName: initialRegistration.fullName,
          ...initialRegistration.customFields
        });
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, [initialRegistration, type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmissionStatus('Mempersiapkan...');

    try {
      console.log('Starting registration submission...');
      
      const timestamp = initialRegistration?.createdAt || Date.now();
      const regId = initialRegistration?.id || `SILAT-${Math.floor(1000 + Math.random() * 9000)}`;

      let photoUrl = initialRegistration?.photoUrl || '';
      if (photo) {
        setSubmissionStatus('Memproses foto...');
        try {
          // Compress and convert to base64
          photoUrl = await compressImageToBase64(photo);
          if (photoUrl.length > 800000) { // Keep it safe under 1MB Firestore limit
            throw new Error('Ukuran foto terlalu besar. Silahkan gunakan foto dengan resolusi lebih kecil.');
          }
        } catch (compErr: any) {
          console.error('Photo processing failed:', compErr);
          throw new Error('Gagal memproses foto: ' + compErr.message);
        }
      }

      setSubmissionStatus('Menyimpan pendaftaran...');
      const { fullName, ...rest } = formData;
      
      const registrationData: Registration = {
        id: regId,
        fullName: fullName || '',
        type: (initialRegistration?.type || type || 'peserta') as 'peserta' | 'pelatih',
        photoUrl: photoUrl,
        customFields: rest,
        createdAt: timestamp,
      };

      console.log('Saving to Firestore...', regId);
      // Increased timeout for Firestore write
      await Promise.race([
        setDoc(doc(db, 'registrations', regId), registrationData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi database lambat. Silahkan coba lagi.')), 45000))
      ]);
      
      setSubmissionStatus('Selesai!');
      onSuccess(registrationData);
    } catch (err: any) {
      console.error('Registration error details:', err);
      setError(err.message || 'Pendaftaran gagal. Silahkan coba lagi.');
      setSubmissionStatus(null);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'registrations');
      } catch (fErr) {}
    } finally {
      setSubmitting(false);
    }
  };

  const compressImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas conversion failed'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => reject(new Error('Format gambar tidak didukung'));
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
    });
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Photo Upload Section */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/50 rounded-2xl flex items-center gap-3 text-rose-500 text-xs font-bold uppercase tracking-widest">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="relative w-40 h-52 rounded-[32px] bg-slate-900 border-2 border-dashed border-slate-700 overflow-hidden group shadow-2xl">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-widest">UPLOAD FOTO</span>
            </div>
          )}
          <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-rose-600/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="text-white w-8 h-8" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] text-center max-w-[240px]">
          UNGGAH FOTO SETENGAH BADAN. FORMAT JPG/PNG MAKS 5MB.
        </p>
      </div>

      {/* Core Fields Grid */}
      <div className="grid md:grid-cols-2 gap-8 ring-1 ring-slate-800 p-8 rounded-3xl bg-slate-900/50">
        {initialRegistration && (
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">ID PENDAFTARAN (TIDAK DAPAT DIUBAH)</label>
            <div className="w-full px-6 py-4 bg-slate-950/50 border border-slate-800/50 rounded-2xl font-mono font-black italic tracking-tighter text-rose-500/50 cursor-not-allowed">
              {initialRegistration.id}
            </div>
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] text-center block w-full">NAMA LENGKAP</label>
          <input
            required
            type="text"
            placeholder="KETIK NAMA LENGKAP ANDA"
            className="w-full px-8 py-6 bg-slate-950 border-2 border-slate-800 rounded-[2.5rem] focus:border-rose-500 outline-none font-black uppercase tracking-widest text-white transition-all text-center text-xl placeholder:text-slate-800"
            value={formData.fullName || ''}
            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>
      </div>

      {/* Dynamic Fields from Form Builder */}
      {fields.length > 0 && (
        <div className="pt-10 border-t border-slate-800 space-y-8">
          <h4 className="font-black text-slate-600 uppercase tracking-[0.5em] text-[10px]">INFORMASI TAMBAHAN</h4>
          <div className="grid md:grid-cols-2 gap-8">
            {fields.map(field => (
              <div key={field.id} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={formData[field.id] || ''}
                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase tracking-wide text-white transition-all appearance-none"
                    onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                  >
                    <option value="">PILIH {field.label}</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    required={field.required}
                    type={field.type}
                    value={formData[field.id] || ''}
                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-rose-500 outline-none font-bold uppercase tracking-wide text-white transition-all"
                    onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-12">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-6 rounded-3xl font-black italic tracking-tighter text-2xl text-white shadow-2xl shadow-rose-600/30 flex items-center justify-center gap-3 hover:bg-rose-500 bg-rose-600 active:scale-[0.98] transition-all uppercase"
        >
          {submitting ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="flex flex-col items-center">
                <span>MEMPROSES...</span>
                {submissionStatus && (
                  <span className="text-[10px] font-bold tracking-widest opacity-70 animate-pulse mt-1">
                    {submissionStatus}
                  </span>
                )}
              </div>
            </>
          ) : (
            'SUBMIT REGISTRASI'
          )}
        </button>
      </div>
      {initialRegistration && (
        <p className="mt-4 text-center text-[10px] font-black text-rose-500 uppercase tracking-widest">
          ANDA SEDANG MENGUBAH DATA PENDAFTARAN {initialRegistration.id}
        </p>
      )}
    </form>
  );
}
