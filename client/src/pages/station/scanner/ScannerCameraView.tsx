import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  CameraDevice,
} from 'html5-qrcode';
import {
  ArrowLeft,
  ScanLine,
  Zap,
  ZapOff,
  SwitchCamera,
  Search,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Camera,
  Lock,
} from 'lucide-react';

interface ScannerCameraViewProps {
  stationName: string;
  stationCode: string;
  onScanSuccess: (decodedToken: string) => void;
  onOpenManualEntry: () => void;
  onOpenDemoMenu: () => void;
  onExit: () => void;
}

type CameraStatus = 'INITIALIZING' | 'SCANNING' | 'FAILED';

export const ScannerCameraView: React.FC<ScannerCameraViewProps> = ({
  stationName,
  stationCode,
  onScanSuccess,
  onOpenManualEntry,
  onOpenDemoMenu,
  onExit,
}) => {
  const [status, setStatus] = useState<CameraStatus>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanLockedRef = useRef(false);
  const containerId = 'irfa-fullscreen-camera-reader';

  // Safely stop stream
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('[Camera] Safe stop:', err);
      }
      scannerRef.current = null;
    }
    setHasTorch(false);
    setIsTorchOn(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      setStatus('INITIALIZING');
      setErrorMessage(null);
      setIsPermissionDenied(false);
      isScanLockedRef.current = false;

      // Check secure context
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setErrorMessage('Camera access requires an HTTPS secure connection.');
        setStatus('FAILED');
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera API is not supported on this device/browser.');
        setStatus('FAILED');
        return;
      }

      await stopCamera();

      // Ensure container is in DOM
      await new Promise((r) => setTimeout(r, 60));
      if (!document.getElementById(containerId)) {
        setErrorMessage('Scanner viewport container not found.');
        setStatus('FAILED');
        return;
      }

      try {
        const qr = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = qr;

        const cameras = await Html5Qrcode.getCameras().catch(() => [] as CameraDevice[]);
        setAvailableCameras(cameras);

        let target: string | MediaTrackConstraints = { facingMode: 'environment' };

        if (preferredCameraId) {
          target = preferredCameraId;
          setSelectedCameraId(preferredCameraId);
        } else if (cameras.length > 0) {
          const rear = cameras.find((c) => /back|rear|environment|macro|main/i.test(c.label));
          if (rear) {
            target = rear.id;
            setSelectedCameraId(rear.id);
          } else {
            target = { facingMode: 'environment' };
          }
        }

        const scanConfig = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minDim * 0.76);
            return {
              width: Math.max(edge, 200),
              height: Math.max(edge, 200),
            };
          },
          aspectRatio: 1.0,
        };

        await qr.start(
          target,
          scanConfig,
          (decodedText) => {
            if (isScanLockedRef.current) return;
            isScanLockedRef.current = true;

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try {
                navigator.vibrate(100);
              } catch (_) {}
            }

            stopCamera().finally(() => {
              onScanSuccess(decodedText.trim());
            });
          },
          () => {
            // Continuous scanning frame noise
          }
        );

        setStatus('SCANNING');

        // Check torch capability
        try {
          const capabilities = qr.getRunningTrackCapabilities() as any;
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        } catch (_) {}
      } catch (err: any) {
        console.error('[Camera] Start error:', err);
        const errStr = (err?.name || err?.message || String(err)).toLowerCase();

        if (errStr.includes('notallowed') || errStr.includes('permission') || errStr.includes('denied')) {
          setIsPermissionDenied(true);
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser.');
        } else if (errStr.includes('notreadable') || errStr.includes('busy') || errStr.includes('trackstart')) {
          setErrorMessage('Camera hardware is currently in use by another app or tab.');
        } else if (errStr.includes('notfound') || errStr.includes('device')) {
          setErrorMessage('No camera found on this device.');
        } else {
          setErrorMessage('Could not initialize camera. Please retry or enter ID manually.');
        }

        setStatus('FAILED');
        await stopCamera();
      }
    },
    [onScanSuccess, stopCamera]
  );

  // Switch camera if multi-camera exists
  const handleSwitchCamera = async () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextCamera = availableCameras[(currentIndex + 1) % availableCameras.length];
    await stopCamera();
    await startCamera(nextCamera.id);
  };

  // Toggle flashlight
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next } as any],
      });
      setIsTorchOn(next);
    } catch (_) {}
  };

  // Auto-start camera immediately upon mounting
  useEffect(() => {
    startCamera();
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }
    };
  }, [startCamera]);

  return (
    <div className="relative w-full h-[calc(100dvh-56px)] md:h-[680px] bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Operational Action Bar */}
      <div className="relative z-20 flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Exit / Back button */}
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Exit</span>
        </button>

        {/* Station Name & Badge */}
        <div className="text-center px-2 min-w-0">
          <div className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs leading-tight">
            {stationName}
          </div>
          <div className="text-[10px] text-blue-300 font-mono tracking-wider">{stationCode}</div>
        </div>

        {/* Hardware Controls (Torch & Camera Switch) */}
        <div className="flex items-center gap-1.5">
          {hasTorch && status === 'SCANNING' && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
            >
              {isTorchOn ? <Zap size={16} /> : <ZapOff size={16} />}
            </button>
          )}

          {availableCameras.length > 1 && status === 'SCANNING' && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md transition-all cursor-pointer"
              title="Switch Camera"
            >
              <SwitchCamera size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Center Viewport */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden bg-black">
        {/* Underlying video element for Html5Qrcode */}
        <div
          id={containerId}
          className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-none"
        />

        {/* State: INITIALIZING */}
        {status === 'INITIALIZING' && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="relative mb-3.5">
              <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <Camera size={20} className="absolute inset-0 m-auto text-blue-400" />
            </div>
            <p className="text-sm font-bold text-white tracking-wide">Starting Camera...</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
              Point your rear camera at the farmer's Digital Fuel Card.
            </p>
          </div>
        )}

        {/* State: SCANNING HUD (Clean Center Targeting Box) */}
        {status === 'SCANNING' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
            {/* Viewfinder Frame */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-xs" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-xs" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-xs" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-xs" />

              {/* Animated scanning laser line */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse" />
            </div>

            {/* Subtle instruction banner */}
            <div className="mt-6 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-slate-200 shadow-md">
              Align Farmer QR Card within frame
            </div>
          </div>
        )}

        {/* State: FAILED / PERMISSION ERROR */}
        {status === 'FAILED' && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-700 text-red-400 grid place-items-center mb-3.5 shadow-lg">
              {isPermissionDenied ? <Lock size={26} /> : <AlertCircle size={26} />}
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              {isPermissionDenied ? 'Camera Permission Required' : 'Camera Unavailable'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[280px] mb-5">
              {errorMessage || 'Unable to access the camera hardware.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
              <button
                type="button"
                onClick={() => startCamera()}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Retry Camera</span>
              </button>

              <button
                type="button"
                onClick={onOpenManualEntry}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <Search size={15} />
                <span>Enter ID Manually</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Secondary Actions Bar */}
      <div className="relative z-20 px-4 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between gap-2">
        {/* Demo Mode Button */}
        <button
          type="button"
          onClick={onOpenDemoMenu}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-semibold backdrop-blur-md transition-all cursor-pointer border border-white/10"
        >
          <Sparkles size={14} className="text-amber-400" />
          <span>Demo Shortcuts</span>
        </button>

        {/* Manual Verification Button */}
        <button
          type="button"
          onClick={onOpenManualEntry}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Search size={14} />
          <span>Manual Entry</span>
        </button>
      </div>
    </div>
  );
};
