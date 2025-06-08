import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { ScannedQR } from '@shared/schema';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  qr: ScannedQR | null;
}

export default function DetailModal({ isOpen, onClose, qr }: DetailModalProps) {
  if (!qr) return null;

  const formatCurrency = (amount: string | null) => {
    if (!amount) return '-';
    return `${parseFloat(amount).toFixed(2)} SAR`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            QR Code Details
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center">
            <Badge 
              variant={qr.status === 'valid' ? 'default' : 'destructive'}
              className="inline-flex items-center"
            >
              {qr.status === 'valid' ? (
                <><CheckCircle className="w-4 h-4 mr-1" />Valid ZATCA QR Code</>
              ) : (
                <><XCircle className="w-4 h-4 mr-1" />Invalid QR Code</>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Seller Name:</dt>
                  <dd className="font-medium text-right auto-dir">{qr.sellerName || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">VAT Number:</dt>
                  <dd className="font-medium text-right">{qr.vatNumber || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Invoice Date:</dt>
                  <dd className="font-medium text-right">{qr.invoiceDate || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Invoice Number:</dt>
                  <dd className="font-medium text-right">{qr.invoiceNumber || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Scanned At:</dt>
                  <dd className="font-medium text-right">{new Date(qr.scannedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Financial Details</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Subtotal:</dt>
                  <dd className="font-medium text-right">{formatCurrency(qr.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">VAT Amount:</dt>
                  <dd className="font-medium text-right">{formatCurrency(qr.vatAmount)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-gray-900 font-medium">Total Amount:</dt>
                  <dd className="font-bold text-lg text-right">{formatCurrency(qr.totalAmount)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Raw QR Data</h4>
            <Textarea
              value={qr.rawData}
              readOnly
              className="w-full h-24 text-xs font-mono bg-gray-50 resize-none"
              placeholder="No raw data available"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
