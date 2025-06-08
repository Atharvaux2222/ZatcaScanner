import { pgTable, text, serial, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scanSessions = pgTable("scan_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scannedQRs = pgTable("scanned_qrs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull(), // 'valid' | 'invalid'
  sellerName: text("seller_name"),
  vatNumber: text("vat_number"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  rawData: text("raw_data").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});

export const insertScanSessionSchema = createInsertSchema(scanSessions).omit({
  id: true,
  createdAt: true,
});

export const insertScannedQRSchema = createInsertSchema(scannedQRs).omit({
  id: true,
  scannedAt: true,
});

export type InsertScanSession = z.infer<typeof insertScanSessionSchema>;
export type ScanSession = typeof scanSessions.$inferSelect;
export type InsertScannedQR = z.infer<typeof insertScannedQRSchema>;
export type ScannedQR = typeof scannedQRs.$inferSelect;
