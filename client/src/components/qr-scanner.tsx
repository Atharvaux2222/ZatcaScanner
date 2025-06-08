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

interface QRScannerProps {
  sessionId: string;
  onScanSuccess?: () => void;
}

interface QRCodeDetector {
  detect(imageData: ImageData): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    QRCodeDetector?: {
      new (): QRCodeDetector;
    };
  }
}

export default function QRScanner({ sessionId, onScanSuccess }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const scanQRFromVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    try {
      // Try using native QRCodeDetector if available
      if (window.QRCodeDetector) {
        const detector = new window.QRCodeDetector();
        const qrCodes = await detector.detect(imageData);
        
        if (qrCodes.length > 0) {
          await processQRCode(qrCodes[0].rawValue);
        }
      }
    } catch (error) {
      // Silent fail for scanning attempts
    }
  };

  const processQRCode = async (qrData: string) => {
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
    }
  };

  const toggleScanning = async () => {
    if (isScanning) {
      setIsScanning(false);
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    } else {
      if (scanMode === 'camera') {
        if (!stream) {
          await startCamera();
        }
        setIsScanning(true);
        scanIntervalRef.current = setInterval(scanQRFromVideo, 500);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      context?.drawImage(img, 0, 0);
      
      const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
      
      if (imageData) {
        try {
          if (window.QRCodeDetector) {
            const detector = new window.QRCodeDetector();
            const qrCodes = await detector.detect(imageData);
            
            if (qrCodes.length > 0) {
              await processQRCode(qrCodes[0].rawValue);
            } else {
              toast({
                title: "No QR Code Found",
                description: "Could not detect a QR code in the uploaded image",
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          toast({
            title: "Scan Error",
            description: "Failed to process uploaded image",
            variant: "destructive",
          });
        }
      }
    };
    
    img.src = URL.createObjectURL(file);
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

        {/* Hidden canvas for QR processing */}
        <canvas ref={canvasRef} className="hidden" />

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
              disabled={!stream}
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
                <div>Seller: <span className="font-medium">{lastScanResult.sellerName}</span></div>
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
