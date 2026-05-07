import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Registration } from '../types';

export const generateAndDownloadPDF = async (elementId: string, registration: Registration, paperSize?: 'id_card' | 'b2' | 'b3') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for capture');
    return;
  }

  // Temporarily remove transform on the actual DOM before html2canvas
  // calculates bounds because html2canvas struggles with CSS transforms.
  const originalTransform = element.style.transform;
  element.style.transform = 'none';
  
  // Also force its dimensions to ensure no clipping if inside overflow:hidden
  const originalWidth = element.style.width;
  const originalHeight = element.style.height;

  // Wait a tiny bit to ensure DOM is ready and transforms are cleared
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const canvas = await html2canvas(element, {
      scale: 3, // Higher scale for better precision
      useCORS: true,
      allowTaint: false, // Changed to false for better CORS security handling
      logging: false,
      backgroundColor: null, // Transparent background to preserve element background
      width: element.offsetWidth,
      height: element.offsetHeight,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          /* Basic resets for capture */
          #id-card-capture { 
            background-color: transparent !important;
            box-shadow: none !important;
            transform: none !important;
            position: relative !important;
            margin: 0 !important;
            border: none !important;
          }
          /* Override common Tailwind classes with safe HEX values */
          .bg-white { background-color: #ffffff !important; }
          .text-white { color: #ffffff !important; }
          .bg-rose-500 { background-color: #f43f5e !important; }
          .bg-rose-600 { background-color: #e11d48 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
          .bg-slate-950 { background-color: #020617 !important; }
          .border-neutral-100 { border-color: #f5f5f5 !important; }
          .border-slate-800 { border-color: #1e293b !important; }
          
          /* Fallback for shadow/glow effects that might use oklch in variables */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            outline-color: #f43f5e !important; 
          }
        `;
        clonedDoc.head.appendChild(style);

        // Scan all elements for computed oklch values and replace with HEX
        const elements = clonedDoc.querySelectorAll('*');
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const computed = window.getComputedStyle(el);
          
          ['backgroundColor', 'color', 'borderColor', 'fill', 'stroke'].forEach(prop => {
            const val = (computed as any)[prop];
            if (val && typeof val === 'string' && val.includes('oklch')) {
              // Simple mapping or forced fallback
              if (prop === 'backgroundColor') htmlEl.style.backgroundColor = '#ffffff';
              else if (prop === 'color') htmlEl.style.color = '#000000';
              else if (prop === 'borderColor') htmlEl.style.borderColor = '#e5e7eb';
            }
          });
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Determine format
    let format: any = [canvas.width, canvas.height];
    if (paperSize === 'b2') format = 'b2';
    else if (paperSize === 'b3') format = 'b3';
    else if (paperSize === 'id_card') format = [85.6 * 2.83465, 53.98 * 2.83465]; // mm to pts approx

    // Determine actual output size mapping (maintain mm physical sizes)
    let finalFormat = format;
    let finalWidthData = canvas.width;
    let finalHeightData = canvas.height;
    
    if (paperSize === 'b2') {
       finalFormat = [500 * 2.83465, 707 * 2.83465];
    } else if (paperSize === 'b3') {
       finalFormat = [353 * 2.83465, 500 * 2.83465];
    }

    const pdf = new jsPDF({
      orientation: paperSize?.startsWith('b') ? 'portrait' : (canvas.width > canvas.height ? 'landscape' : 'portrait'),
      unit: 'pt',
      format: finalFormat !== format ? finalFormat : [canvas.width, canvas.height] 
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`KARTU_SILAT_${registration.id}_${registration.fullName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  } finally {
    // Restore transform
    element.style.transform = originalTransform;
  }
};
