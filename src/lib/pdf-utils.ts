import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Registration } from '../types';
import { saveAs } from 'file-saver';

/**
 * Generates a canvas for a single registration.
 */
export const generateCanvas = async (elementId: string, scale: number = 3): Promise<HTMLCanvasElement | null> => {
  let element = document.getElementById(elementId);
  
  if (!element) {
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      element = document.getElementById(elementId);
      if (element) break;
    }
  }

  if (!element) return null;

  const originalTransform = element.style.transform;
  const originalOpacity = element.style.opacity;
  element.style.transform = 'none';
  element.style.opacity = '1';

  const sanitized = new Map<HTMLElement, Partial<Record<string, string>>>();
  const colorProps = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'caretColor',
    'fill',
    'stroke',
  ];

  const root = element as HTMLElement;
  const targets = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
  for (const node of targets) {
    const cs = window.getComputedStyle(node);
    let didChange = false;
    const prev: Partial<Record<string, string>> = {};

    const boxShadow = cs.boxShadow;
    if (typeof boxShadow === 'string' && boxShadow.includes('oklch')) {
      prev.boxShadow = node.style.boxShadow;
      node.style.boxShadow = 'none';
      didChange = true;
    }

    const textShadow = (cs as any).textShadow as string | undefined;
    if (typeof textShadow === 'string' && textShadow.includes('oklch')) {
      prev.textShadow = (node.style as any).textShadow;
      (node.style as any).textShadow = 'none';
      didChange = true;
    }

    const filter = cs.filter;
    if (typeof filter === 'string' && filter.includes('oklch')) {
      prev.filter = node.style.filter;
      node.style.filter = 'none';
      didChange = true;
    }

    for (const prop of colorProps) {
      const v = (cs as any)[prop];
      if (typeof v === 'string' && v.includes('oklch')) {
        prev[prop] = (node.style as any)[prop];
        if (prop === 'color' || prop === 'caretColor' || prop === 'textDecorationColor' || prop === 'fill' || prop === 'stroke') {
          (node.style as any)[prop] = '#000000';
        } else if (prop === 'backgroundColor') {
          (node.style as any)[prop] = node === root ? '#ffffff' : 'transparent';
        } else {
          (node.style as any)[prop] = 'transparent';
        }
        didChange = true;
      }
    }

    if (didChange) sanitized.set(node, prev);
  }
  
  const imgs = Array.from(element.querySelectorAll('img'));
  const loadPromises = imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  
  await Promise.all(loadPromises);
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.offsetWidth,
      height: element.offsetHeight,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          #id-card-capture, #id-card-capture-admin, #id-card-bulk-capture {
            background-color: #ffffff !important;
            box-shadow: none !important;
            transform: none !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .bg-white { background-color: #ffffff !important; }
          .text-white { color: #ffffff !important; }
          .bg-rose-500 { background-color: #f43f5e !important; }
          .bg-rose-600 { background-color: #e11d48 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
          .bg-slate-950 { background-color: #020617 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .border-neutral-100 { border-color: #f5f5f5 !important; }
          .border-slate-800 { border-color: #1e293b !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
        `;
        clonedDoc.head.appendChild(style);

        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.transform = 'none';
          clonedEl.style.opacity = '1';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.border = 'none';
          clonedEl.style.borderRadius = '0';
        }
      }
    });
    return canvas;
  } catch (error) {
    console.error('Error generating Canvas:', error);
    return null;
  } finally {
    if (element) {
      element.style.transform = originalTransform;
      element.style.opacity = originalOpacity;
    }
    for (const [node, prev] of sanitized.entries()) {
      for (const [k, v] of Object.entries(prev)) {
        (node.style as any)[k] = v ?? '';
      }
    }
  }
};

export const generateAndDownloadPDF = async (
  elementId: string,
  registration: Registration,
  paperSize?: 'id_card' | 'b2' | 'b3',
  options?: { openWindow?: Window | null }
) => {
  const canvas = await generateCanvas(elementId, 2);
  if (!canvas) {
    throw new Error(`CAPTURE_FAILED:${elementId}`);
  }

  const imgData = canvas.toDataURL('image/png', 1.0);
  
  let format: any = [canvas.width, canvas.height];
  if (paperSize === 'b2') format = 'b2';
  else if (paperSize === 'b3') format = 'b3';
  else if (paperSize === 'id_card') format = [85.6 * 2.83465, 53.98 * 2.83465];

  let finalFormat = format;
  if (paperSize === 'b2') finalFormat = [500 * 2.83465, 707 * 2.83465];
  else if (paperSize === 'b3') finalFormat = [353 * 2.83465, 500 * 2.83465];

  const pdf = new jsPDF({
    orientation: paperSize?.startsWith('b') ? 'portrait' : (canvas.width > canvas.height ? 'landscape' : 'portrait'),
    unit: 'pt',
    format: finalFormat
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
  const fileName = `KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`;
  const blob = pdf.output('blob') as Blob;

  const win = options?.openWindow;
  if (win) {
    const url = URL.createObjectURL(blob);
    try {
      win.location.href = url;
    } catch (e) {
      saveAs(blob, fileName);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } else {
    saveAs(blob, fileName);
  }
};

/**
 * Generates a single multi-page PDF for bulk printing.
 */
export const downloadMultiPagePDF = async (
  registrations: Registration[], 
  paperSize: 'id_card' | 'b2' | 'b3' | undefined,
  role: 'peserta' | 'pelatih',
  onProgress?: (current: number, total: number) => void,
  renderElement?: (reg: Registration) => Promise<void>
) => {
  if (registrations.length === 0) return;
  
  let pdf: jsPDF | null = null;
  const total = registrations.length;
  let successCount = 0;

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    if (onProgress) onProgress(i + 1, total);

    if (renderElement) await renderElement(reg);

    // Use lower scale (2) for bulk to save memory
    const canvas = await generateCanvas('id-card-bulk-capture', 1.5); // Lower scale for better stability
    
    if (canvas) {
      const imgData = canvas.toDataURL('image/jpeg', 0.85); // Compress more for bulk
      
      let format: any = [canvas.width, canvas.height];
      if (paperSize === 'b2') format = 'b2';
      else if (paperSize === 'b3') format = 'b3';
      else if (paperSize === 'id_card') format = [85.6 * 2.83465, 53.98 * 2.83465];

      let finalFormat = format;
      if (paperSize === 'b2') finalFormat = [500 * 2.83465, 707 * 2.83465];
      else if (paperSize === 'b3') finalFormat = [353 * 2.83465, 500 * 2.83465];

      const orientation = paperSize?.startsWith('b') ? 'portrait' : (canvas.width > canvas.height ? 'landscape' : 'portrait');

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'pt', format: finalFormat });
      } else {
        pdf.addPage(finalFormat, orientation);
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      successCount++;
    }
    
    // Tiny pause between pages to allow GC to work
    if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (pdf && successCount > 0) {
    pdf.save(`PRINT_MASSAL_${role.toUpperCase()}_EVOKA_${new Date().toISOString().split('T')[0]}.pdf`);
  } else {
    throw new Error(`Gagal membuat file PDF massal.`);
  }
};
