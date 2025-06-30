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
import Logo from '@/components/logo';
import { ScannedQR } from '@shared/schema';

export default function Scanner() {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<ScannedQR | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [clearHistoryTrigger, setClearHistoryTrigger] = useState(0);
  
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
    queryFn: () => apiRequest('GET', `/api/sessions/${sessionId}/stats`).then(res => res.json()),
    enabled: !!sessionId,
  });

  // Get scanned QR codes
  const { data: qrCodes = [] } = useQuery({
    queryKey: ['/api/qr-codes', sessionId],
    queryFn: () => apiRequest('GET', `/api/qr-codes/${sessionId}`).then(res => res.json()),
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
      setClearHistoryTrigger(prev => prev + 1); // Trigger history clear in QR scanner
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
    const confirmMessage = 'All unsaved changes will be deleted. Are you sure you want to clear all scanned data from this session?';
    if (window.confirm(confirmMessage)) {
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
    <div className="min-h-screen relative">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50"></div>
      </div>

      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 py-2 sm:h-20 sm:py-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <Logo className="w-16 h-16 sm:w-32 sm:h-32" />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
              <div className="glass-surface px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl w-full sm:w-auto">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Status: <span className="font-semibold text-primary">Active Session</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                className="glass-button text-destructive hover:text-destructive-foreground hover:bg-destructive/20 w-full sm:w-auto"
                disabled={clearSessionMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Session
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Scanner Panel */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <QRScanner 
              sessionId={sessionId} 
              onScanSuccess={() => {
                // Stats will be refreshed automatically via query invalidation
              }}
              onClearHistory={clearHistoryTrigger > 0 ? () => {
                console.log('Clearing QR scanner history');
              } : undefined}
            />

            {/* Statistics Card */}
            <div className="glass-card p-6">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-primary" />
                  </div>
                  Session Analytics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6">
                  <div className="glass-surface rounded-xl p-3 sm:p-4 text-center border border-primary/20">
                    <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">
                      {stats?.totalScans || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">Total Scans</div>
                  </div>
                  <div className="glass-surface rounded-xl p-3 sm:p-4 text-center border border-success/20">
                    <div className="text-2xl sm:text-3xl font-bold text-success mb-1 sm:mb-2">
                      {stats?.validScans || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">Valid QR Codes</div>
                  </div>
                  <div className="glass-surface rounded-xl p-3 sm:p-4 text-center border border-warning/20">
                    <div className="text-2xl sm:text-3xl font-bold text-warning mb-1 sm:mb-2">
                      {stats?.totalAmount ? stats.totalAmount.toFixed(0) : '0'}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">Total Amount (SAR)</div>
                  </div>
                  <div className="glass-surface rounded-xl p-3 sm:p-4 text-center border border-destructive/20">
                    <div className="text-2xl sm:text-3xl font-bold text-destructive mb-1 sm:mb-2">
                      {stats?.errors || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">Scan Errors</div>
                  </div>
                </div>
            </div>
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
