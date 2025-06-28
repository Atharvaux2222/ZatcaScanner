import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Play, Square, AlertCircle, CheckCircle, Edit3, Flashlight, FlashlightOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseZATCAQR } from '@/lib/zatca-parser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { InsertScannedQR } from '@shared/schema';
import ManualEntryModal from '@/components/manual-entry-modal';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  sessionId: string;
  onScanSuccess?: () => void;
  onClearHistory?: () => void;
}

export default function QRScanner({ sessionId, onScanSuccess, onClearHistory }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [qrScannerInstance, setQrScannerInstance] = useState<QrScanner | null>(null);
  const [lastScannedData, setLastScannedData] = useState<string>('');
  const [scannedDataHistory, setScannedDataHistory] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [hasFlashlightSupport, setHasFlashlightSupport] = useState(false);
  
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
    onError: (error) => {
      console.error('QR mutation error:', error);
    },
  });

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          // Immediate processing for better responsiveness
          if (result?.data && !scanCooldown && !isProcessing) {
            handleQRDetection(result.data);
          }
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10,
          calculateScanRegion: (video) => {
            const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.round(0.8 * smallestDimension);
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
      
      // Check flashlight support after scanner starts
      try {
        const flashSupported = await scanner.hasFlash();
        setHasFlashlightSupport(flashSupported);
      } catch (error) {
        console.log('Flash support check failed:', error);
        setHasFlashlightSupport(false);
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
    if (qrScannerInstance) {
      try {
        qrScannerInstance.stop();
        qrScannerInstance.destroy();
      } catch (error) {
        console.log('Scanner was already destroyed');
      }
      setQrScannerInstance(null);
    }
    // Turn off flashlight when stopping camera
    if (isFlashlightOn) {
      setIsFlashlightOn(false);
    }
    setHasFlashlightSupport(false);
  };

  const toggleFlashlight = async () => {
    if (!qrScannerInstance) {
      toast({
        title: "Camera Not Active",
        description: "Please start the camera first to use the flashlight.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if flashlight is supported first
      const hasFlash = await qrScannerInstance.hasFlash();
      if (!hasFlash) {
        toast({
          title: "Flashlight Not Available",
          description: "Your device doesn't support flashlight control.",
          variant: "destructive",
        });
        return;
      }

      if (isFlashlightOn) {
        await qrScannerInstance.turnFlashOff();
        setIsFlashlightOn(false);
        toast({
          title: "Flashlight Off",
          description: "Flashlight has been turned off.",
        });
      } else {
        await qrScannerInstance.turnFlashOn();
        setIsFlashlightOn(true);
        toast({
          title: "Flashlight On",
          description: "Flashlight has been turned on.",
        });
      }
    } catch (error) {
      console.error('Flashlight error:', error);
      toast({
        title: "Flashlight Error",
        description: "Unable to control flashlight. This feature may not be available in this browser or device.",
        variant: "destructive",
      });
    }
  };

  const clearScannedHistory = () => {
    setScannedDataHistory(new Set());
    setLastScannedData('');
    setLastScanResult(null);
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
            try {
              qrScannerInstance.start();
            } catch (error) {
              // Scanner was destroyed, recreate it
              console.log('Scanner was destroyed, recreating...');
              startCamera();
            }
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
      // Pause scanner during cooldown to prevent continuous scanning
      if (qrScannerInstance && scanMode === 'camera') {
        try {
          qrScannerInstance.stop();
        } catch (error) {
          console.log('Scanner already stopped');
        }
      }
      
      toast({
        title: "Duplicate QR Code",
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
      processQRCode(qrData).catch(console.error);
    } else {
      // Debounce camera scans to prevent rapid-fire detection
      debounceTimeout.current = setTimeout(() => {
        // Double-check that we're not in cooldown and this hasn't been scanned
        if (!scanCooldown && !isProcessing && !scannedDataHistory.has(qrData)) {
          processQRCode(qrData).catch(console.error);
        }
      }, 200);
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
        try {
          qrScannerInstance.stop();
        } catch (error) {
          console.log('Scanner already stopped');
        }
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
    } catch (error: any) {
      // Remove from history if save failed
      setScannedDataHistory(prev => {
        const newSet = new Set(prev);
        newSet.delete(qrData);
        return newSet;
      });
      
      // Check if it's a duplicate QR code error (409 status)
      if (error?.message?.includes('409:') || error?.message?.includes('Duplicate QR code')) {
        toast({
          title: "QR Code Already Scanned",
          description: "This QR code has already been scanned in this session.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Scan Error",
          description: "Failed to save QR code data. Please try again.",
          variant: "destructive",
        });
      }
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
    if (onClearHistory) {
      clearScannedHistory();
    }
  }, [onClearHistory]);

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
    <div className="glass-card p-6 h-fit">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Camera className="w-4 h-4 text-primary" />
        </div>
        QR Code Scanner
      </h2>
        
        {/* Scanner Mode Toggle */}
        <div className="flex mb-6 glass p-1.5 rounded-xl">
          <Button
            variant={scanMode === 'camera' ? 'default' : 'ghost'}
            size="sm"
            className={`flex-1 transition-all duration-300 ${
              scanMode === 'camera' 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:text-foreground hover:bg-white/20'
            }`}
            onClick={() => setScanMode('camera')}
          >
            <Camera className="w-4 h-4 mr-2" />
            Camera
          </Button>
          <Button
            variant={scanMode === 'upload' ? 'default' : 'ghost'}
            size="sm"
            className={`flex-1 transition-all duration-300 ${
              scanMode === 'upload' 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:text-foreground hover:bg-white/20'
            }`}
            onClick={() => setScanMode('upload')}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {/* Manual Entry Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowManualEntry(true)}
            variant="ghost"
            className="w-full h-auto glass-surface border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 text-foreground hover:text-primary p-4 rounded-2xl backdrop-blur-sm"
            size="lg"
          >
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-base">Manual Entry</span>
                  <span className="text-xs text-muted-foreground">
                    Can't scan? Enter details manually
                  </span>
                </div>
              </div>
            </div>
          </Button>
        </div>

        {/* Camera Scanner View */}
        {scanMode === 'camera' && (
          <div className="mb-6">
            <div className="relative glass-surface rounded-2xl overflow-hidden aspect-square border-2 border-primary/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Scanning Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-52 h-52 border-2 border-primary/80 border-dashed rounded-2xl animate-pulse shadow-lg shadow-primary/20"></div>
              </div>
              {/* Corner Indicators */}
              <div className="absolute top-4 left-4 w-6 h-6 border-l-3 border-t-3 border-primary rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-r-3 border-t-3 border-primary rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-3 border-b-3 border-primary rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-3 border-b-3 border-primary rounded-br-lg"></div>
              
              {/* Scanning Animation */}
              {isScanning && !scanCooldown && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-52 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-90 animate-pulse shadow-lg shadow-primary/50"></div>
                </div>
              )}
              {/* Cooldown Overlay */}
              {scanCooldown && (
                <div className="absolute inset-0 flex items-center justify-center glass-surface rounded-2xl">
                  <div className="text-center text-foreground">
                    <div className="text-3xl font-bold mb-2 text-primary">{cooldownTimer}</div>
                    <div className="text-sm text-muted-foreground">Scanning paused</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Upload Area */}
        {scanMode === 'upload' && (
          <div className="mb-6">
            <div 
              className={`glass-surface border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 relative overflow-hidden ${
                scanCooldown 
                  ? 'border-warning/40 cursor-not-allowed' 
                  : 'border-primary/40 hover:border-primary/60 cursor-pointer hover:shadow-lg hover:shadow-primary/10'
              }`}
              onClick={() => !scanCooldown && fileInputRef.current?.click()}
            >
              <div className="relative z-10">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  scanCooldown ? 'bg-warning/20' : 'bg-primary/20'
                }`}>
                  <Upload className={`w-8 h-8 ${scanCooldown ? 'text-warning' : 'text-primary'}`} />
                </div>
                <p className={`text-lg font-medium mb-2 ${scanCooldown ? 'text-warning' : 'text-foreground'}`}>
                  {scanCooldown 
                    ? `Upload paused (${cooldownTimer}s remaining)` 
                    : 'Drop QR code image here'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {!scanCooldown && 'or click to browse files'}
                </p>
              </div>
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${
              scanCooldown ? 'bg-warning animate-pulse shadow-lg shadow-warning/40' : 
              isScanning ? 'bg-primary animate-pulse shadow-lg shadow-primary/40' : 'bg-muted-foreground/40'
            }`} />
            <span className="text-sm font-medium text-foreground">
              {scanCooldown ? `Cooldown: ${cooldownTimer}s` : 
               isScanning ? 'Scanning...' : ''}
            </span>
          </div>
          {scanMode === 'camera' && (
            <div className="flex items-center gap-2">
              {hasFlashlightSupport && (
                <Button
                  onClick={toggleFlashlight}
                  size="sm"
                  variant="outline"
                  disabled={!qrScannerInstance}
                  className={`transition-all duration-300 ${
                    isFlashlightOn 
                      ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 border-yellow-500/40' 
                      : 'glass-button text-muted-foreground hover:text-foreground'
                  }`}
                  title={isFlashlightOn ? 'Turn off flashlight' : 'Turn on flashlight'}
                >
                  {isFlashlightOn ? (
                    <Flashlight className="w-4 h-4" />
                  ) : (
                    <FlashlightOff className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Last Scan Result */}
        {lastScanResult && (
          <div className="glass-surface rounded-2xl p-6 border border-primary/20">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                {lastScanResult.status === 'valid' ? (
                  <CheckCircle className="w-3 h-3 text-primary" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-destructive" />
                )}
              </div>
              Last Scan Result
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={lastScanResult.status === 'valid' ? 'default' : 'destructive'}
                  className={`${lastScanResult.status === 'valid' 
                    ? 'bg-primary/20 text-primary border-primary/30' 
                    : 'bg-destructive/20 text-destructive border-destructive/30'
                  } backdrop-blur-sm`}
                >
                  {lastScanResult.status === 'valid' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Valid ZATCA QR</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" />Invalid QR</>
                  )}
                </Badge>
              </div>
              {lastScanResult.sellerName && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-muted-foreground min-w-0 flex-shrink-0">Seller:</span>
                  <span className="font-medium text-foreground break-words">{lastScanResult.sellerName}</span>
                </div>
              )}
              {lastScanResult.totalAmount && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-primary text-lg">{parseFloat(lastScanResult.totalAmount).toFixed(2)} SAR</span>
                </div>
              )}
              {lastScanResult.invoiceDate && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">{lastScanResult.invoiceDate}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Entry Modal */}
        <ManualEntryModal
          isOpen={showManualEntry}
          onClose={() => setShowManualEntry(false)}
          sessionId={sessionId}
          onSuccess={() => {
            setShowManualEntry(false);
            onScanSuccess?.();
          }}
        />
    </div>
  );
}
