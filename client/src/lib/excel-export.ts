import * as XLSX from 'xlsx';
import { ScannedQR } from '@shared/schema';

export interface ExportOptions {
  filename: string;
  includeHeaders: boolean;
  exportRange: 'all' | 'selected' | 'valid';
  selectedIds?: number[];
}

export function exportToExcel(
  qrCodes: ScannedQR[], 
  options: ExportOptions
): void {
  let dataToExport = qrCodes;
  
  // Filter data based on export range
  switch (options.exportRange) {
    case 'selected':
      if (options.selectedIds) {
        dataToExport = qrCodes.filter(qr => options.selectedIds!.includes(qr.id));
      }
      break;
    case 'valid':
      dataToExport = qrCodes.filter(qr => qr.status === 'valid');
      break;
    default:
      // 'all' - use all data
      break;
  }
  
  // Transform data for Excel export
  const excelData = dataToExport.map((qr, index) => ({
    'Row': index + 1,
    'Status': qr.status === 'valid' ? 'Valid' : 'Invalid',
    'Seller Name': qr.sellerName || '-',
    'VAT Number': qr.vatNumber || '-',
    'Invoice Number': qr.invoiceNumber || '-',
    'Invoice Date': qr.invoiceDate || '-',
    'Subtotal (SAR)': qr.subtotal ? parseFloat(qr.subtotal).toFixed(2) : '-',
    'VAT Amount (SAR)': qr.vatAmount ? parseFloat(qr.vatAmount).toFixed(2) : '-',
    'Total Amount (SAR)': qr.totalAmount ? parseFloat(qr.totalAmount).toFixed(2) : '-',
    'Scanned At': qr.scannedAt.toLocaleString(),
  }));
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData, { 
    header: options.includeHeaders ? undefined : [],
    skipHeader: !options.includeHeaders 
  });
  
  // Set column widths
  const colWidths = [
    { wch: 5 },   // Row
    { wch: 10 },  // Status
    { wch: 25 },  // Seller Name
    { wch: 20 },  // VAT Number
    { wch: 20 },  // Invoice Number
    { wch: 12 },  // Invoice Date
    { wch: 15 },  // Subtotal
    { wch: 15 },  // VAT Amount
    { wch: 15 },  // Total Amount
    { wch: 20 },  // Scanned At
  ];
  ws['!cols'] = colWidths;
  
  // Add summary row
  if (options.includeHeaders && dataToExport.length > 0) {
    const validQRs = dataToExport.filter(qr => qr.status === 'valid');
    const totalAmount = validQRs.reduce((sum, qr) => 
      sum + (qr.totalAmount ? parseFloat(qr.totalAmount) : 0), 0
    );
    const totalVAT = validQRs.reduce((sum, qr) => 
      sum + (qr.vatAmount ? parseFloat(qr.vatAmount) : 0), 0
    );
    
    // Add empty row and summary
    const summaryData = [
      {},
      {
        'Row': 'SUMMARY',
        'Status': `${validQRs.length} Valid`,
        'Seller Name': `${dataToExport.length} Total`,
        'VAT Number': '-',
        'Invoice Number': '-',
        'Invoice Date': '-',
        'Subtotal (SAR)': (totalAmount - totalVAT).toFixed(2),
        'VAT Amount (SAR)': totalVAT.toFixed(2),
        'Total Amount (SAR)': totalAmount.toFixed(2),
        'Scanned At': new Date().toLocaleString(),
      }
    ];
    
    XLSX.utils.sheet_add_json(ws, summaryData, { 
      origin: -1, 
      skipHeader: true 
    });
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'ZATCA QR Codes');
  
  // Generate filename with timestamp if not provided
  const filename = options.filename || `zatca_qr_export_${new Date().toISOString().split('T')[0]}`;
  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  // Save file
  XLSX.writeFile(wb, finalFilename);
}
