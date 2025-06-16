import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanSessionSchema, insertScannedQRSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create or get scan session
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertScanSessionSchema.parse(req.body);
      const session = await storage.createSession(sessionData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ message: "Invalid session data", error });
    }
  });

  app.get("/api/sessions/:sessionId", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Error fetching session", error });
    }
  });

  // Add scanned QR code
  app.post("/api/qr-codes", async (req, res) => {
    try {
      const qrData = insertScannedQRSchema.parse(req.body);
      
      // Fast response - process immediately without validation delays
      const qr = await storage.addScannedQR(qrData);
      
      // Send response immediately
      res.status(201).json(qr);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate QR code')) {
        res.status(409).json({ message: "Duplicate QR code detected in this session", error: error.message });
      } else {
        res.status(400).json({ message: "Invalid QR data", error });
      }
    }
  });

  // Get scanned QR codes for session
  app.get("/api/qr-codes/:sessionId", async (req, res) => {
    try {
      const qrs = await storage.getScannedQRs(req.params.sessionId);
      res.json(qrs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching QR codes", error });
    }
  });

  // Delete specific QR code
  app.delete("/api/qr-codes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteScannedQR(id);
      if (success) {
        res.json({ message: "QR code deleted" });
      } else {
        res.status(404).json({ message: "QR code not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting QR code", error });
    }
  });

  // Clear all QR codes for session
  app.delete("/api/sessions/:sessionId/qr-codes", async (req, res) => {
    try {
      await storage.clearSessionQRs(req.params.sessionId);
      res.json({ message: "All QR codes cleared" });
    } catch (error) {
      res.status(500).json({ message: "Error clearing QR codes", error });
    }
  });

  // Get session statistics
  app.get("/api/sessions/:sessionId/stats", async (req, res) => {
    try {
      const stats = await storage.getSessionStats(req.params.sessionId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching statistics", error });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
