import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Play, Square, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseZATCAQR } from '@/lib/zatca-parser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { InsertScannedQR } from '@shared/schema';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  sessionId: string;
  onScanSuccess?: () => void;
}

export default function QRScanner({ sessionId, onScanSuccess }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [qrScannerInstance, setQrScannerInstance] = useState<QrScanner | null>(null);
  const [lastScannedData, setLastScannedData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addQRMutation = useMutation({
    mutationFn: async (qrData: InsertScannedQR) => {
      const response = await apiRequest('POST', '/api/qr-codes', qrData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'stats'] });
      onScanSuccess?.();
    },
  });

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          handleQRDetection(result.data);
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      
      setQrScannerInstance(scanner);
      await scanner.start();
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (qrScannerInstance) {
      qrScannerInstance.destroy();
      setQrScannerInstance(null);
    }
  };

  const handleQRDetection = (qrData: string) => {
    // Prevent duplicate scans and debounce rapid detections
    if (qrData === lastScannedData || isProcessing) {
      return;
    }

    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Debounce the processing to prevent rapid-fire scans
    debounceTimeout.current = setTimeout(() => {
      processQRCode(qrData);
    }, 1000); // 1 second debounce
  };

  const processQRCode = async (qrData: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setLastScannedData(qrData);
    const parsedData = parseZATCAQR(qrData);
    
    const qrRecord: InsertScannedQR = {
      sessionId,
      rawData: qrData,
      status: parsedData ? 'valid' : 'invalid',
      sellerName: parsedData?.sellerName || null,
      vatNumber: parsedData?.vatNumber || null,
      invoiceNumber: parsedData?.invoiceNumber || null,
      invoiceDate: parsedData?.invoiceDate || null,
      subtotal: parsedData?.subtotal?.toString() || null,
      vatAmount: parsedData?.vatAmount?.toString() || null,
      totalAmount: parsedData?.totalAmount?.toString() || null,
    };

    try {
      await addQRMutation.mutateAsync(qrRecord);
      setLastScanResult(qrRecord);
      
      toast({
        title: parsedData ? "QR Code Scanned Successfully" : "Invalid QR Code",
        description: parsedData 
          ? `ZATCA QR code from ${parsedData.sellerName} processed`
          : "QR code is not in ZATCA format",
        variant: parsedData ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Scan Error",
        description: "Failed to save QR code data",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleScanning = async () => {
    if (isScanning) {
      setIsScanning(false);
      stopCamera();
    } else {
      if (scanMode === 'camera') {
        setIsScanning(true);
        await startCamera();
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      });
      
      handleQRDetection(result.data);
    } catch (error) {
      toast({
        title: "No QR Code Found",
        description: "Could not detect a QR code in the uploaded image",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [scanMode]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <Card className="h-fit">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">QR Code Scanner</h2>
        
        {/* Scanner Mode Toggle */}
        <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
          <Button
            variant={scanMode === 'camera' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setScanMode('camera')}
          >
            <Camera className="w-4 h-4 mr-2" />
            Camera
          </Button>
          <Button
            variant={scanMode === 'upload' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setScanMode('upload')}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {/* Camera Scanner View */}
        {scanMode === 'camera' && (
          <div className="mb-4">
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-square">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Scanning Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg opacity-60"></div>
              </div>
              {/* Scanning Animation */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-1 bg-primary opacity-75 animate-pulse"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Upload Area */}
        {scanMode === 'upload' && (
          <div className="mb-4">
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2 mx-auto" />
              <p className="text-sm text-gray-600">Drop QR code image here or click to upload</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}



        {/* Scan Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-600">
              {isScanning ? 'Scanning...' : 'Ready to scan'}
            </span>
          </div>
          {scanMode === 'camera' && (
            <Button
              onClick={toggleScanning}
              size="sm"
              disabled={false}
            >
              {isScanning ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Scan
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Scan
                </>
              )}
            </Button>
          )}
        </div>

        {/* Last Scan Result */}
        {lastScanResult && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Last Scan Result</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center">
                Status: 
                <Badge 
                  variant={lastScanResult.status === 'valid' ? 'default' : 'destructive'}
                  className="ml-1"
                >
                  {lastScanResult.status === 'valid' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Valid ZATCA QR</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" />Invalid QR</>
                  )}
                </Badge>
              </div>
              {lastScanResult.sellerName && (
                <div>Seller: <span className="font-medium auto-dir">{lastScanResult.sellerName}</span></div>
              )}
              {lastScanResult.totalAmount && (
                <div>Amount: <span className="font-medium">{parseFloat(lastScanResult.totalAmount).toFixed(2)} SAR</span></div>
              )}
              {lastScanResult.invoiceDate && (
                <div>Date: <span className="font-medium">{lastScanResult.invoiceDate}</span></div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
