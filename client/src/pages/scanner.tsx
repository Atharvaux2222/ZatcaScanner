import { useState, useEffect } from 'react';
import { QrCode, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import QRScanner from '@/components/qr-scanner';
import ScanTable from '@/components/scan-table';
import ExportModal from '@/components/export-modal';
import DetailModal from '@/components/detail-modal';
import { ScannedQR } from '@shared/schema';

export default function Scanner() {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<ScannedQR | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sessions', { sessionId });
      return response.json();
    },
  });

  // Get session stats
  const { data: stats } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'stats'],
    enabled: !!sessionId,
  });

  // Get scanned QR codes
  const { data: qrCodes = [] } = useQuery({
    queryKey: ['/api/qr-codes', sessionId],
    enabled: !!sessionId,
  });

  // Clear session
  const clearSessionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/sessions/${sessionId}/qr-codes`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'stats'] });
      toast({
        title: "Session Cleared",
        description: "All scan data has been cleared",
      });
    },
  });

  useEffect(() => {
    createSessionMutation.mutate();
  }, []);

  const handleClearSession = async () => {
    if (confirm('Are you sure you want to clear all scanned data?')) {
      await clearSessionMutation.mutateAsync();
    }
  };

  const handleExport = (exportSelectedIds: number[]) => {
    setSelectedIds(exportSelectedIds);
    setShowExportModal(true);
  };

  const handleViewDetails = (qr: ScannedQR) => {
    setSelectedQR(qr);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <QrCode className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">ZATCA QR Scanner</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Session: <span className="font-medium">Active</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                className="text-gray-600 hover:text-gray-900"
                disabled={clearSessionMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Scanner Panel */}
          <div className="lg:col-span-1 space-y-6">
            <QRScanner 
              sessionId={sessionId} 
              onScanSuccess={() => {
                // Stats will be refreshed automatically via query invalidation
              }}
            />

            {/* Statistics Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {stats?.totalScans || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Scans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.validScans || 0}
                    </div>
                    <div className="text-sm text-gray-600">Valid QR Codes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats?.totalAmount ? stats.totalAmount.toFixed(0) : '0'}
                    </div>
                    <div className="text-sm text-gray-600">Total Amount (SAR)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {stats?.errors || 0}
                    </div>
                    <div className="text-sm text-gray-600">Scan Errors</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <div className="lg:col-span-2">
            <ScanTable 
              sessionId={sessionId}
              onExport={handleExport}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        qrCodes={qrCodes}
        selectedIds={selectedIds}
      />

      <DetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        qr={selectedQR}
      />
    </div>
  );
}
