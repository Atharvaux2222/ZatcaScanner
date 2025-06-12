import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Trash2, 
  FileSpreadsheet, 
  Eye, 
  CheckCircle, 
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ScannedQR } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface ScanTableProps {
  sessionId: string;
  onExport: (selectedIds: number[]) => void;
  onViewDetails: (qr: ScannedQR) => void;
}

export default function ScanTable({ sessionId, onExport, onViewDetails }: ScanTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: qrCodes = [], isLoading } = useQuery({
    queryKey: ['/api/qr-codes', sessionId],
    queryFn: () => apiRequest('GET', `/api/qr-codes/${sessionId}`).then(res => res.json()),
    enabled: !!sessionId,
  });

  const deleteQRMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/qr-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'stats'] });
      toast({
        title: "Record Deleted",
        description: "QR code record has been removed",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/sessions/${sessionId}/qr-codes`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'stats'] });
      setSelectedIds(new Set());
      toast({
        title: "All Records Cleared",
        description: "All QR code records have been removed",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(qrCodes.map((qr: ScannedQR) => qr.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteRecord = async (id: number) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteQRMutation.mutateAsync(id);
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all QR codes?')) {
      await clearAllMutation.mutateAsync();
    }
  };

  const handleExport = () => {
    onExport(Array.from(selectedIds));
  };

  // Pagination
  const totalPages = Math.ceil(qrCodes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = qrCodes.slice(startIndex, endIndex);

  const progressPercentage = qrCodes.length > 0 
    ? Math.round((qrCodes.filter((qr: ScannedQR) => qr.status === 'valid').length / qrCodes.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="glass-card p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 glass rounded-2xl w-1/3"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 glass rounded-xl"></div>
              ))}
            </div>
          </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
              </div>
              Scanned QR Codes
            </h2>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={qrCodes.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={qrCodes.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Processing Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Checkbox
                    checked={selectedIds.size === qrCodes.length && qrCodes.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAT Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No QR codes scanned yet. Start scanning to see results here.
                  </td>
                </tr>
              ) : (
                currentItems.map((qr: ScannedQR) => (
                  <tr key={qr.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Checkbox
                        checked={selectedIds.has(qr.id)}
                        onCheckedChange={(checked) => handleSelectItem(qr.id, checked as boolean)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        variant={qr.status === 'valid' ? 'default' : 'destructive'}
                        className="inline-flex items-center"
                      >
                        {qr.status === 'valid' ? (
                          <><CheckCircle className="w-3 h-3 mr-1" />Valid</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" />Invalid</>
                        )}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="auto-dir">{qr.sellerName || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {qr.vatNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {qr.invoiceDate || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {qr.totalAmount ? `${parseFloat(qr.totalAmount).toFixed(2)} SAR` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {qr.vatAmount ? `${parseFloat(qr.vatAmount).toFixed(2)} SAR` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(qr)}
                        className="text-primary hover:text-blue-700 mr-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRecord(qr.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={deleteQRMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {qrCodes.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium">{startIndex + 1}-{Math.min(endIndex, qrCodes.length)}</span> of <span className="font-medium">{qrCodes.length}</span> results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
