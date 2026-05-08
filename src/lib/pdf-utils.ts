import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Registration } from '../types';
import JSZip from 'jszip';
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
  }
};

export const generateAndDownloadPDF = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3') => {
  const canvas = await generateCanvas(elementId, 3);
  if (!canvas) return;

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
  pdf.save(`KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`);
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
