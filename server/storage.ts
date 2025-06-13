import { 
  scanSessions, 
  scannedQRs, 
  type ScanSession, 
  type InsertScanSession,
  type ScannedQR,
  type InsertScannedQR 
} from "@shared/schema";

export interface IStorage {
  // Session management
  createSession(session: InsertScanSession): Promise<ScanSession>;
  getSession(sessionId: string): Promise<ScanSession | undefined>;
  
  // QR code management
  addScannedQR(qr: InsertScannedQR): Promise<ScannedQR>;
  getScannedQRs(sessionId: string): Promise<ScannedQR[]>;
  deleteScannedQR(id: number): Promise<boolean>;
  clearSessionQRs(sessionId: string): Promise<boolean>;
  
  // Statistics
  getSessionStats(sessionId: string): Promise<{
    totalScans: number;
    validScans: number;
    totalAmount: number;
    errors: number;
  }>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, ScanSession>;
  private qrs: Map<number, ScannedQR>;
  private currentSessionId: number;
  private currentQRId: number;

  constructor() {
    this.sessions = new Map();
    this.qrs = new Map();
    this.currentSessionId = 1;
    this.currentQRId = 1;
  }

  async createSession(insertSession: InsertScanSession): Promise<ScanSession> {
    const id = this.currentSessionId++;
    const session: ScanSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<ScanSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async addScannedQR(insertQR: InsertScannedQR): Promise<ScannedQR> {
    // Only check for duplicates if it's not a manual entry
    if (!insertQR.isManualEntry) {
      const existingQRs = Array.from(this.qrs.values())
        .filter(qr => qr.sessionId === insertQR.sessionId && qr.rawData === insertQR.rawData);
      
      if (existingQRs.length > 0) {
        throw new Error('Duplicate QR code detected in this session');
      }
    }
    
    const id = this.currentQRId++;
    const qr: ScannedQR = {
      id,
      sessionId: insertQR.sessionId,
      status: insertQR.status,
      rawData: insertQR.rawData,
      sellerName: insertQR.sellerName || null,
      vatNumber: insertQR.vatNumber || null,
      invoiceNumber: insertQR.invoiceNumber || null,
      invoiceDate: insertQR.invoiceDate || null,
      subtotal: insertQR.subtotal || null,
      vatAmount: insertQR.vatAmount || null,
      totalAmount: insertQR.totalAmount || null,
      isManualEntry: insertQR.isManualEntry || false,
      notes: insertQR.notes || null,
      scannedAt: new Date(),
    };
    this.qrs.set(id, qr);
    return qr;
  }

  async getScannedQRs(sessionId: string): Promise<ScannedQR[]> {
    return Array.from(this.qrs.values())
      .filter(qr => qr.sessionId === sessionId)
      .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
  }

  async deleteScannedQR(id: number): Promise<boolean> {
    return this.qrs.delete(id);
  }

  async clearSessionQRs(sessionId: string): Promise<boolean> {
    const qrsToDelete = Array.from(this.qrs.entries())
      .filter(([_, qr]) => qr.sessionId === sessionId)
      .map(([id]) => id);
    
    qrsToDelete.forEach(id => this.qrs.delete(id));
    return true;
  }

  async getSessionStats(sessionId: string): Promise<{
    totalScans: number;
    validScans: number;
    totalAmount: number;
    errors: number;
  }> {
    const qrs = await this.getScannedQRs(sessionId);
    const validQRs = qrs.filter(qr => qr.status === 'valid');
    
    return {
      totalScans: qrs.length,
      validScans: validQRs.length,
      totalAmount: validQRs.reduce((sum, qr) => sum + (parseFloat(qr.totalAmount || '0')), 0),
      errors: qrs.filter(qr => qr.status === 'invalid').length,
    };
  }
}

export const storage = new MemStorage();
