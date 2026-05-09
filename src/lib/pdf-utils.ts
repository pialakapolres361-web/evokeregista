import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { PdfConfig, Registration } from '../types';
import { saveAs } from 'file-saver';

const MM_TO_PT = 2.83465;
const DESIGN_WIDTH = 500;
const getDesignHeight = (paperSize?: 'id_card' | 'b2' | 'b3') => {
  if (paperSize === 'b2') return 707;
  if (paperSize === 'b3') return 708;
  return 315;
};

function parseHexColor(input?: string) {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s.startsWith('#')) return null;
  const hex = s.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function parseCssColorToRgb(input?: string) {
  if (!input) return null;
  const hex = parseHexColor(input);
  if (hex) return hex;
  if (typeof document === 'undefined' || !document.body) return null;

  const probe = document.createElement('span');
  probe.style.color = input;
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '-9999px';

  try {
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  } finally {
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  }
}

function sanitizeFilename(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

async function fetchAsDataUrl(url: string) {
  if (url.startsWith('data:')) {
    const mime = url.slice(5, url.indexOf(';')) || 'image/png';
    return { dataUrl: url, mime };
  }

  const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
  if (!res.ok) throw new Error(`Gagal memuat gambar (${res.status})`);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca gambar'));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, mime: blob.type || 'image/png' };
}

async function getImageSize(dataUrl: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = dataUrl;
  await (img.decode ? img.decode() : new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal decode gambar'));
  }));
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

function computeDrawRect(
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
  size: string | undefined,
  position: string | undefined
) {
  if (size === '100% 100%') {
    return { x: 0, y: 0, w: pageW, h: pageH };
  }

  const mode = size === 'contain' ? 'contain' : 'cover';
  const scale = mode === 'contain' ? Math.min(pageW / imgW, pageH / imgH) : Math.max(pageW / imgW, pageH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;

  let x = (pageW - w) / 2;
  let y = (pageH - h) / 2;
  const pos = (position || 'center').toLowerCase();
  if (pos === 'top') y = 0;
  else if (pos === 'bottom') y = pageH - h;
  else if (pos === 'left') x = 0;
  else if (pos === 'right') x = pageW - w;
  return { x, y, w, h };
}

function getPdfFormatPt(paperSize?: 'id_card' | 'b2' | 'b3') {
  if (paperSize === 'b2') return { w: 500 * MM_TO_PT, h: 707 * MM_TO_PT, orientation: 'portrait' as const };
  if (paperSize === 'b3') return { w: 353 * MM_TO_PT, h: 500 * MM_TO_PT, orientation: 'portrait' as const };
  return { w: 85.6 * MM_TO_PT, h: 53.98 * MM_TO_PT, orientation: 'landscape' as const };
}

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
    const baseOptions = {
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff' as any,
      width: element.offsetWidth,
      height: element.offsetHeight,
      onclone: (clonedDoc: Document) => {
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
          (clonedEl as HTMLElement).style.transform = 'none';
          (clonedEl as HTMLElement).style.opacity = '1';
          (clonedEl as HTMLElement).style.boxShadow = 'none';
          (clonedEl as HTMLElement).style.border = 'none';
          (clonedEl as HTMLElement).style.borderRadius = '0';
        }
      },
    };

    // Prefer foreignObjectRendering to avoid html2canvas CSS color parsing limitations (oklch).
    try {
      const canvas = await html2canvas(element, {
        ...baseOptions,
        foreignObjectRendering: true,
      } as any);
      return canvas;
    } catch (e) {
      const canvas = await html2canvas(element, {
        ...baseOptions,
        foreignObjectRendering: false,
      } as any);
      return canvas;
    }
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

export const generatePDFBlobFromConfig = async (
  registration: Registration,
  pdfConfig: PdfConfig
): Promise<Blob> => {
  const paperSize = pdfConfig.paperSize || 'id_card';
  const designHeight = getDesignHeight(paperSize);
  const { w: pageW, h: pageH, orientation } = getPdfFormatPt(paperSize);
  const xScale = pageW / DESIGN_WIDTH;
  const yScale = pageH / designHeight;

  const pdf = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] as any });

  // Background
  if (pdfConfig.backgroundUrl) {
    const { dataUrl } = await fetchAsDataUrl(pdfConfig.backgroundUrl);
    const { width: imgW, height: imgH } = await getImageSize(dataUrl);
    const rect = computeDrawRect(imgW, imgH, pageW, pageH, pdfConfig.backgroundSize, pdfConfig.backgroundPosition);
    pdf.addImage(dataUrl, 'PNG', rect.x, rect.y, rect.w, rect.h);
  }

  // Photo
  const photoEl = pdfConfig.elements?.photo;
  if (photoEl?.visible !== false && registration.photoUrl && photoEl.width && photoEl.height) {
    const { dataUrl } = await fetchAsDataUrl(registration.photoUrl);
    const x = (photoEl.x - photoEl.width / 2) * xScale;
    const y = photoEl.y * yScale;
    const w = photoEl.width * xScale;
    const h = photoEl.height * yScale;
    pdf.addImage(dataUrl, 'PNG', x, y, w, h);
  }

  // Text elements
  const entries = Object.entries(pdfConfig.elements || {});
  for (const [key, el] of entries) {
    if (key === 'photo') continue;
    if (el.visible === false) continue;

    let content = '';
    if (key === 'name') content = registration.fullName || '';
    else if (key === 'id') content = registration.id || '';
    else content = String(registration.customFields?.[key] ?? '');
    if (!content) continue;

    const x = el.x * xScale;
    const y = el.y * yScale;
    const fontSize = (el.fontSize || 12) * Math.min(xScale, yScale);
    pdf.setFontSize(fontSize);

    const c = parseCssColorToRgb(el.color);
    if (c) pdf.setTextColor(c.r, c.g, c.b);
    else pdf.setTextColor(15, 23, 42);

    pdf.text(String(content).toUpperCase(), x, y, { align: 'center', baseline: 'top' } as any);
  }

  return pdf.output('blob') as Blob;
};

export const generateAndDownloadPDFFromConfig = async (
  registration: Registration,
  pdfConfig: PdfConfig,
  options?: { openWindow?: Window | null }
) => {
  const blob = await generatePDFBlobFromConfig(registration, pdfConfig);
  const fileName = `KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`;
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

export const downloadZipPDFsFromConfig = async (
  registrations: Registration[],
  pdfConfig: PdfConfig,
  role: 'peserta' | 'pelatih',
  onProgress?: (current: number, total: number) => void
) => {
  if (registrations.length === 0) return;

  const zip = new JSZip();
  const folderName = role === 'peserta' ? 'PDF_PESERTA' : 'PDF_PELATIH';
  const folder = zip.folder(folderName) || zip;

  const total = registrations.length;
  let successCount = 0;

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    if (onProgress) onProgress(i + 1, total);

    try {
      const blob = await generatePDFBlobFromConfig(reg, pdfConfig);
      const safeName = sanitizeFilename(reg.fullName || 'TANPA_NAMA');
      const safeId = sanitizeFilename(reg.id || String(i + 1));
      const fileName = `KARTU_${folderName}_${safeId}_${safeName}.pdf`;
      folder.file(fileName, blob);
      successCount++;
    } catch (e) {
      // skip failed entry
    }

    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (successCount === 0) {
    throw new Error('Gagal membuat file PDF untuk semua pendaftar.');
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  saveAs(zipBlob, `KARTU_${folderName}_EVOKA_${new Date().toISOString().split('T')[0]}.zip`);
};

// Backward compatible API: still supports html2canvas capture, but will not be used by UI anymore.
export const generateAndDownloadPDF = async (
  elementId: string,
  registration: Registration,
  paperSize?: 'id_card' | 'b2' | 'b3',
  options?: { openWindow?: Window | null }
) => {
  const canvas = await generateCanvas(elementId, 2);
  if (!canvas) throw new Error(`CAPTURE_FAILED:${elementId}`);

  const imgData = canvas.toDataURL('image/png', 1.0);
  const paper = paperSize || 'id_card';
  const { w: pageW, h: pageH, orientation } = getPdfFormatPt(paper);
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] as any });
  pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);

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
