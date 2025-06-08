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
    // Tag 1: Seller name (Arabic/English)
    // Tag 2: VAT registration number
    // Tag 3: Invoice date and time
    // Tag 4: Invoice total (including VAT)
    // Tag 5: VAT total
    
    let decodedData: string;
    let binaryData: Uint8Array;
    
    // Try to decode if it's base64
    try {
      const base64String = qrData.replace(/\s/g, '');
      binaryData = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
      decodedData = new TextDecoder('utf-8').decode(binaryData);
    } catch {
      // If not base64, try UTF-8 decoding of raw data
      try {
        const encoder = new TextEncoder();
        binaryData = encoder.encode(qrData);
        decodedData = new TextDecoder('utf-8').decode(binaryData);
      } catch {
        // Fallback to raw string
        decodedData = qrData;
        binaryData = Uint8Array.from(qrData, c => c.charCodeAt(0));
      }
    }
    
    const data: Partial<ZATCAData> = {};
    let position = 0;
    
    while (position < binaryData.length) {
      if (position + 1 >= binaryData.length) break;
      
      const tag = binaryData[position];
      const length = binaryData[position + 1];
      
      if (position + 2 + length > binaryData.length) break;
      
      // Extract value as UTF-8 string for proper Arabic text handling
      const valueBytes = binaryData.slice(position + 2, position + 2 + length);
      const value = new TextDecoder('utf-8').decode(valueBytes);
      
      switch (tag) {
        case 1: // Seller name (supports Arabic text)
          data.sellerName = value.trim();
          break;
        case 2: // VAT registration number
          data.vatNumber = value.trim();
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
