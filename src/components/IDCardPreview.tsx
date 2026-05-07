import React, { useRef, useEffect, useState } from 'react';
import { Registration, PdfConfig, FormField } from '../types';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';

interface IDCardPreviewProps {
  registration: Registration;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export default function IDCardPreview({ registration, containerRef }: IDCardPreviewProps) {
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
  }, []);

  useEffect(() => {
    if (!wrapperRef.current || !config) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        const designWidth = config.paperSize?.startsWith('b') ? 350 : 450;
        
        // Add a small buffer to avoid floating point layout rounding issues
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

  if (loading || !config) return <div className="aspect-[3/4] bg-neutral-100 animate-pulse rounded-2xl w-full max-w-[450px] mx-auto" />;

  // Sort keys to ensure predictable rendering order (Core fields first, then Custom fields by their 'order' from form_builder)
  const sortedElementKeys = Object.keys(config.elements).sort((a, b) => {
    const coreOrder = ['photo', 'name', 'id'];
    const idxA = coreOrder.indexOf(a);
    const idxB = coreOrder.indexOf(b);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // For custom fields, use the order from form_builder
    const fieldA = fields.find(f => f.id === a);
    const fieldB = fields.find(f => f.id === b);
    return (fieldA?.order || 0) - (fieldB?.order || 0);
  });

  const designWidth = config.paperSize?.startsWith('b') ? 350 : 450;
  const designHeight = config.paperSize?.startsWith('b') ? 495 : 300;

  return (
    <div 
      ref={wrapperRef} 
      className="w-full flex justify-center overflow-hidden"
      style={{ height: `${designHeight * scale}px` }}
    >
      <div 
        ref={containerRef}
        id="id-card-capture"
        className="relative overflow-hidden rounded-2xl bg-white border border-neutral-100 origin-top"
        style={{ 
          backgroundImage: `url(${config.backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#ffffff',
          width: `${designWidth}px`,
          height: `${designHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          flexShrink: 0
        }}
      >
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
            // Check custom fields
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
      </div>
    </div>
  );
}
