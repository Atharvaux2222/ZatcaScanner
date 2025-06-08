export interface ZATCAData {
  sellerName: string;
  vatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

export function parseZATCAQR(qrData: string): ZATCAData | null {
  try {
    // ZATCA QR codes use TLV (Tag-Length-Value) format
    // The data is base64 encoded and follows specific tags:
    // Tag 1: Seller name
    // Tag 2: VAT registration number
    // Tag 3: Invoice date and time
    // Tag 4: Invoice total (including VAT)
    // Tag 5: VAT total
    
    let decodedData: string;
    
    // Try to decode if it's base64
    try {
      decodedData = atob(qrData);
    } catch {
      // If not base64, treat as raw data
      decodedData = qrData;
    }
    
    const data: Partial<ZATCAData> = {};
    let position = 0;
    
    while (position < decodedData.length) {
      if (position + 1 >= decodedData.length) break;
      
      const tag = decodedData.charCodeAt(position);
      const length = decodedData.charCodeAt(position + 1);
      
      if (position + 2 + length > decodedData.length) break;
      
      const value = decodedData.substring(position + 2, position + 2 + length);
      
      switch (tag) {
        case 1: // Seller name
          data.sellerName = value;
          break;
        case 2: // VAT registration number
          data.vatNumber = value;
          break;
        case 3: // Invoice date and time (ISO format)
          data.invoiceDate = value.split('T')[0]; // Extract date part
          break;
        case 4: // Invoice total including VAT
          data.totalAmount = parseFloat(value);
          break;
        case 5: // VAT total
          data.vatAmount = parseFloat(value);
          break;
      }
      
      position += 2 + length;
    }
    
    // Calculate subtotal if we have total and VAT
    if (data.totalAmount && data.vatAmount) {
      data.subtotal = data.totalAmount - data.vatAmount;
    }
    
    // Generate invoice number if not present
    if (!data.invoiceNumber) {
      data.invoiceNumber = `INV-${Date.now()}`;
    }
    
    // Validate required fields
    if (data.sellerName && data.vatNumber && data.totalAmount !== undefined) {
      return data as ZATCAData;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing ZATCA QR:', error);
    return null;
  }
}

export function isValidZATCAQR(qrData: string): boolean {
  return parseZATCAQR(qrData) !== null;
}
