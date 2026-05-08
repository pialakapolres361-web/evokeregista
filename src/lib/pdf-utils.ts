import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Registration } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Generates a PDF for a single registration and returns it as a Blob or saves it.
 */
export const generatePDFBlob = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3'): Promise<Blob | null> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for capture:', elementId);
    return null;
  }

  const originalTransform = element.style.transform;
  element.style.transform = 'none';
  
  await new Promise(resolve => setTimeout(resolve, 150));

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null,
      width: element.offsetWidth,
      height: element.offsetHeight,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          #id-card-capture { 
            background-color: transparent !important;
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
          .border-neutral-100 { border-color: #f5f5f5 !important; }
          .border-slate-800 { border-color: #1e293b !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
        `;
        clonedDoc.head.appendChild(style);
      }
    });

    const imgData = canvas.toDataURL('image/png');
    
    let format: any = [canvas.width, canvas.height];
    if (paperSize === 'b2') format = 'b2';
    else if (paperSize === 'b3') format = 'b3';
    else if (paperSize === 'id_card') format = [85.6 * 2.83465, 53.98 * 2.83465];

    let finalFormat = format;
    if (paperSize === 'b2') {
       finalFormat = [500 * 2.83465, 707 * 2.83465];
    } else if (paperSize === 'b3') {
       finalFormat = [353 * 2.83465, 500 * 2.83465];
    }

    const pdf = new jsPDF({
      orientation: paperSize?.startsWith('b') ? 'portrait' : (canvas.width > canvas.height ? 'landscape' : 'portrait'),
      unit: 'pt',
      format: finalFormat
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF Blob:', error);
    return null;
  } finally {
    element.style.transform = originalTransform;
  }
};

export const generateAndDownloadPDF = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3') => {
  const blob = await generatePDFBlob(elementId, registration, paperSize);
  if (blob) {
    const fileName = `KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`;
    saveAs(blob, fileName);
  }
};

/**
 * Bulk generates PDFs and downloads them as a ZIP file.
 * This requires a way to render each registration one by one.
 */
export const downloadBulkZip = async (
  registrations: Registration[], 
  paperSize: 'id_card' | 'b2' | 'b3' | undefined,
  role: 'peserta' | 'pelatih',
  onProgress?: (current: number, total: number) => void,
  renderElement?: (reg: Registration) => Promise<void>
) => {
  const zip = new JSZip();
  const total = registrations.length;

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    if (onProgress) onProgress(i + 1, total);

    // If a render function is provided, use it to update the DOM
    if (renderElement) {
      await renderElement(reg);
    }

    const blob = await generatePDFBlob('id-card-capture', reg, paperSize);
    if (blob) {
      // Create a folder structure inside the ZIP
      const folderName = role === 'peserta' ? 'PDF_PESERTA' : 'PDF_PELATIH';
      const fileName = `KARTU_${reg.id}_${reg.fullName.replace(/\s+/g, '_')}.pdf`;
      zip.file(`${folderName}/${fileName}`, blob);
      console.log(`Added to ZIP: ${fileName}`);
    }
  }

  console.log('Generating ZIP archive...');
  const content = await zip.generateAsync({ 
    type: 'blob',
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
  
  const zipName = `KARTU_${role.toUpperCase()}_EVOKA_${new Date().toISOString().split('T')[0]}.zip`;
  saveAs(content, zipName);
  console.log(`ZIP downloaded: ${zipName}`);
};
