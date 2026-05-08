import React, { useRef, useEffect, useState } from 'react';
import { Registration, PdfConfig, FormField } from '../types';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';

interface IDCardPreviewProps {
  registration: Registration;
  containerRef?: React.RefObject<HTMLDivElement>;
  containerId?: string;
}

export default function IDCardPreview({ registration, containerRef, containerId = "id-card-capture" }: IDCardPreviewProps) {
  const [config, setConfig] = useState<PdfConfig | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Fetch the correct PDF config based on registration type
    const docId = registration.type === 'pelatih' ? 'pdf_config_pelatih' : 'pdf_config';
    const unsubPdf = onSnapshot(doc(db, 'settings', docId), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as PdfConfig);
      } else {
        setConfig({
          backgroundUrl: registration.type === 'pelatih' 
            ? 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&q=80&w=1000'
            : 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&q=80&w=1000',
          elements: {
            name: { x: 50, y: 150, fontSize: 24, visible: true },
            id: { x: 50, y: 180, fontSize: 16, visible: true },
            photo: { x: 250, y: 100, width: 100, height: 120, visible: true }
          }
        });
      }
      setLoading(false);
    });

    const unsubFields = onSnapshot(query(collection(db, 'form_builder'), orderBy('order', 'asc')), (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField)));
    });

    return () => {
      unsubPdf();
      unsubFields();
    };
  }, [registration.type]);

  useEffect(() => {
    if (!wrapperRef.current || !config) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        const designWidth = config.paperSize?.startsWith('b') ? 350 : 450;
        
        if (width < designWidth) {
           setScale(width / designWidth);
        } else {
           setScale(1);
        }
      }
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [config]);

  // Sort keys to ensure predictable rendering order
  const sortedElementKeys = config ? Object.keys(config.elements).sort((a, b) => {
    const coreOrder = ['photo', 'name', 'id'];
    const idxA = coreOrder.indexOf(a);
    const idxB = coreOrder.indexOf(b);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    const fieldA = fields.find(f => f.id === a);
    const fieldB = fields.find(f => f.id === b);
    return (fieldA?.order || 0) - (fieldB?.order || 0);
  }) : [];

  const designWidth = 500;
  const designHeight = config?.paperSize === 'b2' ? 707 : config?.paperSize === 'b3' ? 708 : 315;

  return (
    <div 
      ref={wrapperRef} 
      className="w-full flex justify-center overflow-hidden"
      style={{ height: config ? `${designHeight * scale}px` : '315px' }}
    >
      <div 
        ref={containerRef}
        id={containerId}
        className={`relative overflow-hidden rounded-2xl bg-white border border-neutral-100 origin-top-left transition-opacity duration-300 ${!config ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          backgroundColor: '#ffffff',
          width: `${designWidth}px`,
          height: `${designHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          flexShrink: 0
        }}
      >
        {(!config || loading) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Background Image */}
            {config.backgroundUrl && (
              <img 
                src={config.backgroundUrl}
                alt="Background"
                crossOrigin="anonymous"
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ 
                  objectFit: (config.backgroundSize as any) || 'cover',
                  objectPosition: config.backgroundPosition || 'center'
                }}
              />
            )}

            {/* Render elements in sorted order */}
            {sortedElementKeys.map((key) => {
              const item = config.elements[key];
              const el = item as { x: number; y: number; fontSize: number; color?: string; width?: number; height?: number };
              if (key === 'photo') {
                if (!registration.photoUrl) return null;
                return (
                  <div 
                    key={key}
                    className="absolute border-4 border-white shadow-lg overflow-hidden bg-white"
                    style={{ 
                      left: `${el.x - (el.width || 0) / 2}px`, 
                      top: `${el.y}px`, 
                      width: `${el.width}px`, 
                      height: `${el.height}px`
                    }}
                  >
                    <div 
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${registration.photoUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                  </div>
                );
              }

              let content = '';
              if (key === 'name') content = registration.fullName;
              else if (key === 'id') content = registration.id;
              else {
                content = registration.customFields?.[key] || '';
              }

              if (!content) return null;

              return (
                <div 
                  key={key}
                  className={`absolute font-bold tracking-tight uppercase ${key === 'id' ? 'font-mono' : ''}`}
                  style={{ 
                    left: `${el.x - 1000}px`, 
                    width: '2000px',
                    top: `${el.y}px`, 
                    fontSize: `${el.fontSize}px`,
                    color: el.color || (key === 'id' ? '#64748b' : '#0f172a'),
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {content}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
