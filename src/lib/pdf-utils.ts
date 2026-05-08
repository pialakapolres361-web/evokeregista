import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Registration } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Generates a PDF for a single registration and returns it as a Blob.
 */
export const generatePDFData = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3'): Promise<ArrayBuffer | null> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for capture:', elementId);
    return null;
  }

  // Ensure element is visible and stable
  const originalTransform = element.style.transform;
  const originalOpacity = element.style.opacity;
  element.style.transform = 'none';
  element.style.opacity = '1';
  
  // Wait for layout stability
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
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

    const imgData = canvas.toDataURL('image/png', 1.0);
    
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
    return pdf.output('arraybuffer');
  } catch (error) {
    console.error('Error generating PDF Data:', error);
    return null;
  } finally {
    element.style.transform = originalTransform;
    element.style.opacity = originalOpacity;
  }
};

export const generateAndDownloadPDF = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3') => {
  const data = await generatePDFData(elementId, registration, paperSize);
  if (data) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const fileName = `KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`;
    saveAs(blob, fileName);
  }
};

/**
 * Bulk generates PDFs and downloads them as a ZIP file.
 */
export const downloadBulkZip = async (
  registrations: Registration[], 
  paperSize: 'id_card' | 'b2' | 'b3' | undefined,
  role: 'peserta' | 'pelatih',
  onProgress?: (current: number, total: number) => void,
  renderElement?: (reg: Registration) => Promise<void>
) => {
  if (registrations.length === 0) return;
  
  const zip = new JSZip();
  const folderName = role === 'peserta' ? 'PDF_PESERTA' : 'PDF_PELATIH';
  const folder = zip.folder(folderName);
  
  const total = registrations.length;
  let successCount = 0;

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    if (onProgress) onProgress(i + 1, total);

    if (renderElement) {
      await renderElement(reg);
    }

    // Use a specific ID for bulk capture to avoid conflicts
    const data = await generatePDFData('id-card-bulk-capture', reg, paperSize);
    if (data && folder) {
      const fileName = `KARTU_${reg.id}_${reg.fullName.replace(/\s+/g, '_')}.pdf`;
      folder.file(fileName, data);
      successCount++;
    }
  }

  if (successCount === 0) {
    throw new Error("Gagal membuat file PDF. Silahkan coba lagi.");
  }

  const content = await zip.generateAsync({ 
    type: 'blob',
    mimeType: 'application/zip',
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
  
  const zipName = `KARTU_${role.toUpperCase()}_EVOKA_${new Date().toISOString().split('T')[0]}.zip`;
  saveAs(content, zipName);
};
