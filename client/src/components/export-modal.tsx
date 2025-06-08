import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileSpreadsheet, Download } from 'lucide-react';
import { ScannedQR } from '@shared/schema';
import { exportToExcel, ExportOptions } from '@/lib/excel-export';
import { useToast } from '@/hooks/use-toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodes: ScannedQR[];
  selectedIds: number[];
}

export default function ExportModal({ isOpen, onClose, qrCodes, selectedIds }: ExportModalProps) {
  const [exportRange, setExportRange] = useState<'all' | 'selected' | 'valid'>('all');
  const [filename, setFilename] = useState(`zatca_qr_export_${new Date().toISOString().split('T')[0]}`);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  
  const { toast } = useToast();

  const getRecordCount = (range: 'all' | 'selected' | 'valid') => {
    switch (range) {
      case 'all':
        return qrCodes.length;
      case 'selected':
        return selectedIds.length;
      case 'valid':
        return qrCodes.filter(qr => qr.status === 'valid').length;
      default:
        return 0;
    }
  };

  const handleExport = () => {
    const options: ExportOptions = {
      filename,
      includeHeaders,
      exportRange,
      selectedIds: exportRange === 'selected' ? selectedIds : undefined,
    };

    try {
      exportToExcel(qrCodes, options);
      
      toast({
        title: "Export Successful",
        description: `Excel file "${filename}.xlsx" has been downloaded`,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "An error occurred while generating the Excel file",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileSpreadsheet className="w-5 h-5 text-green-600 mr-3" />
            Export to Excel
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-gray-600">
            Choose export options for your scanned QR code data.
          </p>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-range" className="text-sm font-medium text-gray-700">
                Export Range
              </Label>
              <Select value={exportRange} onValueChange={(value: 'all' | 'selected' | 'valid') => setExportRange(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Records ({getRecordCount('all')} items)
                  </SelectItem>
                  <SelectItem value="selected" disabled={selectedIds.length === 0}>
                    Selected Records ({getRecordCount('selected')} items)
                  </SelectItem>
                  <SelectItem value="valid">
                    Valid Records Only ({getRecordCount('valid')} items)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="filename" className="text-sm font-medium text-gray-700">
                File Name
              </Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="zatca_qr_export_2024-01-15"
                className="mt-1"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-headers"
                checked={includeHeaders}
                onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
              />
              <Label htmlFor="include-headers" className="text-sm text-gray-700">
                Include column headers
              </Label>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleExport}
              disabled={getRecordCount(exportRange) === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
