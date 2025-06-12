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
  onClearHistory?: () => void;
}

export default function QRScanner({ sessionId, onScanSuccess }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [qrScannerInstance, setQrScannerInstance] = useState<QrScanner | null>(null);
  const [lastScannedData, setLastScannedData] = useState<string>('');
  const [scannedDataHistory, setScannedDataHistory] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);
  
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
          maxScansPerSecond: 5,
          calculateScanRegion: (video) => {
            const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.round(0.7 * smallestDimension);
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          },
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

  const startCooldown = () => {
    setScanCooldown(true);
    setCooldownTimer(3);
    
    cooldownInterval.current = setInterval(() => {
      setCooldownTimer((prev) => {
        if (prev <= 1) {
          setScanCooldown(false);
          if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current);
          }
          
          // Restart scanner after cooldown if we were scanning
          if (isScanning && qrScannerInstance && scanMode === 'camera') {
            qrScannerInstance.start();
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleQRDetection = (qrData: string) => {
    // Prevent scanning during cooldown or if already processing
    if (scanCooldown || isProcessing) {
      return;
    }

    // Check if this QR code has already been scanned in this session
    if (scannedDataHistory.has(qrData)) {
      toast({
        title: "Already Scanned",
        description: "This QR code has already been scanned in this session.",
        variant: "destructive",
      });
      startCooldown(); // Still apply cooldown to prevent spam
      return;
    }

    // Check if this is the same as the last scanned QR (within a short time window)
    if (qrData === lastScannedData) {
      return;
    }

    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Process immediately for file uploads, debounce for camera
    if (scanMode === 'upload') {
      processQRCode(qrData);
    } else {
      // Debounce camera scans to prevent rapid-fire detection
      debounceTimeout.current = setTimeout(() => {
        // Double-check that we're not in cooldown and this hasn't been scanned
        if (!scanCooldown && !isProcessing && !scannedDataHistory.has(qrData)) {
          processQRCode(qrData);
        }
      }, 500);
    }
  };

  const processQRCode = async (qrData: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setLastScannedData(qrData);
    
    // Add to scanned history to prevent future duplicates
    setScannedDataHistory(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(qrData);
      return newSet;
    });
    
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
      
      // Temporarily stop the scanner to prevent immediate re-scanning
      if (qrScannerInstance && isScanning) {
        qrScannerInstance.stop();
      }
      
      // Start cooldown period after successful scan
      startCooldown();
      
      toast({
        title: parsedData ? "✅ QR Code Scanned!" : "❌ Invalid QR Code",
        description: parsedData 
          ? `ZATCA QR code processed successfully. Scanning paused for 3 seconds.`
          : "QR code is not in ZATCA format. Scanning paused for 3 seconds.",
        variant: parsedData ? "default" : "destructive",
      });
    } catch (error) {
      // Remove from history if save failed
      setScannedDataHistory(prev => {
        const newSet = new Set(prev);
        newSet.delete(qrData);
        return newSet;
      });
      
      toast({
        title: "Scan Error",
        description: "Failed to save QR code data. Please try again.",
        variant: "destructive",
      });
      // Still start cooldown even on error to prevent spam
      startCooldown();
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

    if (scanCooldown) {
      toast({
        title: "Please Wait",
        description: `Scanning is paused. Please wait ${cooldownTimer} seconds.`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Enhanced scanning for better detection of blurry images
      const result = await QrScanner.scanImage(file);
      
      handleQRDetection(result);
    } catch (error) {
      // Try with different image processing if first attempt fails
      try {
        // Create a canvas to enhance the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async () => {
          canvas.width = img.width * 2; // Upscale for better detection
          canvas.height = img.height * 2;
          
          // Enhanced rendering with image smoothing disabled for sharper edges
          ctx!.imageSmoothingEnabled = false;
          ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob and try scanning again
          canvas.toBlob(async (blob) => {
            if (blob) {
              try {
                const enhancedResult = await QrScanner.scanImage(blob);
                handleQRDetection(enhancedResult);
              } catch {
                toast({
                  title: "No QR Code Found",
                  description: "Could not detect a QR code in the uploaded image. Try a clearer image.",
                  variant: "destructive",
                });
              }
            }
          });
        };
        
        img.src = URL.createObjectURL(file);
      } catch {
        toast({
          title: "No QR Code Found",
          description: "Could not detect a QR code in the uploaded image. Try a clearer image.",
          variant: "destructive",
        });
      }
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
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
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
              {isScanning && !scanCooldown && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-1 bg-primary opacity-75 animate-pulse"></div>
                </div>
              )}
              {/* Cooldown Overlay */}
              {scanCooldown && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 rounded-lg">
                  <div className="text-center text-white">
                    <div className="text-2xl font-bold mb-2">{cooldownTimer}</div>
                    <div className="text-sm">Scanning paused</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Upload Area */}
        {scanMode === 'upload' && (
          <div className="mb-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative ${
                scanCooldown 
                  ? 'border-orange-300 bg-orange-50 cursor-not-allowed' 
                  : 'border-gray-300 hover:border-primary cursor-pointer'
              }`}
              onClick={() => !scanCooldown && fileInputRef.current?.click()}
            >
              <Upload className={`w-8 h-8 mb-2 mx-auto ${scanCooldown ? 'text-orange-400' : 'text-gray-400'}`} />
              <p className={`text-sm ${scanCooldown ? 'text-orange-600' : 'text-gray-600'}`}>
                {scanCooldown 
                  ? `Scanning paused (${cooldownTimer}s remaining)` 
                  : 'Drop QR code image here or click to upload'
                }
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={scanCooldown}
              />
            </div>
          </div>
        )}



        {/* Scan Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              scanCooldown ? 'bg-orange-500 animate-pulse' : 
              isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-sm text-gray-600">
              {scanCooldown ? `Cooldown: ${cooldownTimer}s` : 
               isScanning ? 'Scanning...' : 'Ready to scan'}
            </span>
          </div>
          {scanMode === 'camera' && (
            <Button
              onClick={toggleScanning}
              size="sm"
              disabled={scanCooldown}
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
