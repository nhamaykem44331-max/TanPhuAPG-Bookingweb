'use client';

import { useCallback, useRef, useState } from 'react';

// Hook xuất mặt vé (TicketFace) ra PDF/ảnh — trích từ app/quote/page.tsx và bổ sung báo lỗi cho khách.
// Bọc phần tử cần chụp bằng ref trả về, rồi gọi exportPdf()/exportJpg().

export type ExportKind = 'pdf' | 'jpg' | null;

export function useTicketExport(fileBaseName = 'MatVe-TanPhuAPG') {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState<ExportKind>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const captureCanvas = useCallback(async () => {
    if (!printRef.current) return null;
    const h2c = (await import('html2canvas')).default;
    return h2c(printRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
  }, []);

  const exportPdf = useCallback(async () => {
    setExporting('pdf');
    setExportError(null);
    try {
      const canvas = await captureCanvas();
      if (!canvas) throw new Error('no-canvas');
      const { jsPDF } = await import('jspdf');
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF({
        orientation: height > width ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [width, height],
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height);
      pdf.save(`${fileBaseName}.pdf`);
    } catch (error) {
      console.error('[ticket-export] pdf failed', error);
      setExportError('Không tải được mặt vé. Vui lòng thử lại hoặc liên hệ hotline.');
    } finally {
      setExporting(null);
    }
  }, [captureCanvas, fileBaseName]);

  const exportJpg = useCallback(async () => {
    setExporting('jpg');
    setExportError(null);
    try {
      const canvas = await captureCanvas();
      if (!canvas) throw new Error('no-canvas');
      const link = document.createElement('a');
      link.download = `${fileBaseName}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error('[ticket-export] jpg failed', error);
      setExportError('Không tải được mặt vé. Vui lòng thử lại hoặc liên hệ hotline.');
    } finally {
      setExporting(null);
    }
  }, [captureCanvas, fileBaseName]);

  return { printRef, exporting, exportError, exportPdf, exportJpg };
}
