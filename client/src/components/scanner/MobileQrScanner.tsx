import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  CameraDevice,
} from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  RefreshCw,
  SwitchCamera,
  Zap,
  ZapOff,
  AlertCircle,
  X,
  ScanLine,
  Lock,
} from 'lucide-react';

interface MobileQrScannerProps {
  isOpen: boolean;
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

type ScannerStatus = 'IDLE' | 'INITIALIZING' | 'SCANNING' | 'FAILED' | 'STOPPING';

interface ScannerErrorInfo {
  title: string;
  message: string;
  isPermissionDenied: boolean;
  canRetry: boolean;
}

export const MobileQrScanner: React.FC<MobileQrScannerProps> = ({
  isOpen,
  onScan,
  onClose,
}) => {
  const [status, setStatus] = useState<ScannerStatus>('IDLE');
  const [errorInfo, setErrorInfo] = useState<ScannerErrorInfo | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanLockedRef = useRef<boolean>(false);
  const isInitializingRef = useRef<boolean>(false);
  const containerId = 'irfa-mobile-qr-reader';

  // Detect in-app webviews (e.g. Telegram, Facebook, Instagram, WeChat)
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isWebView =
        /FBAN|FBAV|Instagram|Telegram|Line|MicroMessenger|musical_ly|Bytedance|wv/i.test(ua);
      setIsInAppBrowser(isWebView);
    }
  }, []);

  // Classify standard WebRTC and hardware errors into user-friendly diagnostic guidance
  const parseCameraError = (err: any): ScannerErrorInfo => {
    const errorStr = (err?.name || err?.message || String(err)).toLowerCase();

    if (
      errorStr.includes('notallowederror') ||
      errorStr.includes('permission') ||
      errorStr.includes('denied')
    ) {
      return {
        title: 'Camera Permission Denied',
        message:
          'Camera access was blocked by your browser. Please tap the lock / settings icon in your address bar, enable Camera permissions, and tap "Retry Camera".',
        isPermissionDenied: true,
        canRetry: true,
      };
    }

    if (
      errorStr.includes('notreadableerror') ||
      errorStr.includes('trackstart') ||
      errorStr.includes('in use') ||
      errorStr.includes('busy')
    ) {
      return {
        title: 'Camera Currently In Use',
        message:
          'Your camera is being used by another application or browser tab. Please close other camera apps and tap "Retry Camera".',
        isPermissionDenied: false,
        canRetry: true,
      };
    }

    if (
      errorStr.includes('notfounderror') ||
      errorStr.includes('devicesnotfound') ||
      errorStr.includes('no camera')
    ) {
      return {
        title: 'No Camera Found',
        message:
          'No compatible camera hardware was detected on this device. You can still enter Farmer IDs manually below.',
        isPermissionDenied: false,
        canRetry: false,
      };
    }

    if (errorStr.includes('security') || (typeof window !== 'undefined' && !window.isSecureContext)) {
      return {
        title: 'HTTPS Secure Context Required',
        message:
          'Browsers block camera access on insecure connections. Please access this app over HTTPS.',
        isPermissionDenied: false,
        canRetry: false,
      };
    }

    if (errorStr.includes('overconstrained')) {
      return {
        title: 'Camera Resolution Constraint Error',
        message:
          'The requested camera resolution was not supported. Tap "Retry Camera" to fallback to automatic settings.',
        isPermissionDenied: false,
        canRetry: true,
      };
    }

    return {
      title: 'Camera Initialization Failed',
      message:
        err?.message ||
        'Could not start mobile camera. Please ensure camera permissions are granted and retry.',
      isPermissionDenied: false,
      canRetry: true,
    };
  };

  // Safely stop any running scanner instance and clear stream locks
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('[QR Scanner] Safe stop warning:', err);
      } finally {
        scannerRef.current = null;
      }
    }
    setHasTorch(false);
    setIsTorchOn(false);
    setStatus('IDLE');
  }, []);

  // Main camera start pipeline
  const startScanner = useCallback(
    async (preferredCameraId?: string) => {
      // Prevent overlapping initialization attempts
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      setStatus('INITIALIZING');
      setErrorInfo(null);
      isScanLockedRef.current = false;

      // 1. Check secure context & mediaDevices availability
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setErrorInfo({
          title: 'HTTPS Connection Required',
          message: 'Camera video streaming requires a secure HTTPS origin.',
          isPermissionDenied: false,
          canRetry: false,
        });
        setStatus('FAILED');
        isInitializingRef.current = false;
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setErrorInfo({
          title: 'Camera API Not Supported',
          message:
            'Your browser does not support the WebRTC MediaDevices camera API. If you are in an in-app browser, please open directly in Chrome.',
          isPermissionDenied: false,
          canRetry: false,
        });
        setStatus('FAILED');
        isInitializingRef.current = false;
        return;
      }

      // 2. Ensure container element exists in DOM
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        // Wait a tick for React DOM mount if just opened
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      if (!document.getElementById(containerId)) {
        setErrorInfo({
          title: 'Viewport Error',
          message: 'Camera viewport element was not found in the DOM.',
          isPermissionDenied: false,
          canRetry: true,
        });
        setStatus('FAILED');
        isInitializingRef.current = false;
        return;
      }

      // 3. Stop previous instance if exists
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }

      try {
        // 4. Instantiate clean low-level Html5Qrcode (not the opinionated Html5QrcodeScanner)
        const html5Qr = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = html5Qr;

        // 5. Query and store available cameras
        const cameras = await Html5Qrcode.getCameras().catch((err) => {
          console.warn('[QR Scanner] Camera enumeration warning:', err);
          return [] as CameraDevice[];
        });
        setAvailableCameras(cameras);

        // 6. Camera Selection Strategy:
        // Priority A: Specifically requested cameraId
        // Priority B: Constraint { facingMode: 'environment' } (Rear/Back camera)
        // Priority C: Enumerate and pick camera with label containing 'back' or 'rear'
        // Priority D: Fallback to first available camera
        let cameraTarget: string | MediaTrackConstraints = { facingMode: 'environment' };

        if (preferredCameraId) {
          cameraTarget = preferredCameraId;
          setSelectedCameraId(preferredCameraId);
        } else if (cameras.length > 0) {
          const rearCam = cameras.find((c) =>
            /back|rear|environment|macro|main/i.test(c.label)
          );
          if (rearCam) {
            cameraTarget = rearCam.id;
            setSelectedCameraId(rearCam.id);
          } else {
            cameraTarget = { facingMode: 'environment' };
          }
        }

        // 7. Optimal Mobile QR Viewfinder Configuration
        const scanConfig = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minDim * 0.75);
            return {
              width: Math.max(edge, 190),
              height: Math.max(edge, 190),
            };
          },
          aspectRatio: 1.0,
        };

        // 8. Start scanning stream
        await html5Qr.start(
          cameraTarget,
          scanConfig,
          (decodedText) => {
            // Anti-double-scan debounce lock
            if (isScanLockedRef.current) return;
            isScanLockedRef.current = true;

            // Optional subtle haptic feedback on mobile
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try {
                navigator.vibrate(100);
              } catch (_) {}
            }

            // Immediately halt stream and pass decoded text
            stopScanner().finally(() => {
              onScan(decodedText.trim());
            });
          },
          () => {
            // Frame scan failure (per-frame noise, completely normal until a QR enters view)
          }
        );

        // 9. Successfully started
        setStatus('SCANNING');

        // Check if flashlight / torch capability exists on the active track
        try {
          const capabilities = html5Qr.getRunningTrackCapabilities() as any;
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        } catch (_) {}
      } catch (err: any) {
        console.error('[QR Scanner] Camera start error:', err);

        // If facingMode: 'environment' threw an OverconstrainedError or NotFoundError, try deviceId fallback
        if (
          (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError') &&
          !preferredCameraId
        ) {
          try {
            const fallbackCameras = await Html5Qrcode.getCameras().catch(() => []);
            if (fallbackCameras.length > 0) {
              const lastCam = fallbackCameras[fallbackCameras.length - 1]; // Often the rear camera on Android
              await scannerRef.current?.start(
                lastCam.id,
                { fps: 10, aspectRatio: 1.0 },
                (decodedText) => {
                  if (isScanLockedRef.current) return;
                  isScanLockedRef.current = true;
                  stopScanner().finally(() => onScan(decodedText.trim()));
                },
                () => {}
              );
              setSelectedCameraId(lastCam.id);
              setStatus('SCANNING');
              isInitializingRef.current = false;
              return;
            }
          } catch (retryErr) {
            console.error('[QR Scanner] Fallback camera also failed:', retryErr);
          }
        }

        const parsed = parseCameraError(err);
        setErrorInfo(parsed);
        setStatus('FAILED');
        await stopScanner();
      } finally {
        isInitializingRef.current = false;
      }
    },
    [onScan, stopScanner]
  );

  // Switch between front & back cameras if multiple are present
  const handleSwitchCamera = async () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];

    await stopScanner();
    await startScanner(nextCamera.id);
  };

  // Toggle mobile flashlight / torch
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('[QR Scanner] Torch toggle error:', err);
    }
  };

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      // Teardown when component unmounts
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
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="mt-5 max-w-sm sm:max-w-md mx-auto bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 text-white select-none transition-all">
      {/* Top Header Strip */}
      <div className="bg-slate-900/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ScanLine size={16} className="text-blue-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wide text-slate-200">
            {status === 'SCANNING'
              ? 'Camera Active · Scan Card'
              : status === 'INITIALIZING'
              ? 'Initializing Camera...'
              : status === 'FAILED'
              ? 'Scanner Unavailable'
              : 'QR Scanner'}
          </span>
        </div>

        <button
          onClick={() => {
            stopScanner();
            onClose();
          }}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Close Camera"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Viewport Container */}
      <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
        {/* Actual Video Reader Element for Html5Qrcode */}
        <div
          id={containerId}
          className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-none"
        />

        {/* State: INITIALIZING / LOADING */}
        {status === 'INITIALIZING' && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="relative mb-3">
              <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <Camera size={20} className="absolute inset-0 m-auto text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">Starting Camera Hardware...</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
              Requesting browser camera permission. Please grant permission if prompted.
            </p>
          </div>
        )}

        {/* State: SCANNING OVERLAY (High-Tech Viewfinder HUD) */}
        {status === 'SCANNING' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6 z-10">
            {/* Viewfinder Target Frame */}
            <div className="relative w-56 h-56 my-auto">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />

              {/* Animated laser scanning line */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-bounce" />
            </div>

            {/* Instruction Banner */}
            <div className="bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-[11px] font-medium text-slate-300">
              Align Farmer Card QR inside the frame
            </div>
          </div>
        )}

        {/* State: FAILED / ERROR CARD */}
        {status === 'FAILED' && errorInfo && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-red-950/70 border border-red-800 text-red-400 grid place-items-center mb-3">
              {errorInfo.isPermissionDenied ? <Lock size={22} /> : <AlertCircle size={22} />}
            </div>

            <h4 className="text-sm font-bold text-white mb-1.5">{errorInfo.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[280px] mb-4">
              {errorInfo.message}
            </p>

            {/* In-App Browser Guidance */}
            {isInAppBrowser && (
              <div className="mb-4 p-2 bg-amber-950/40 border border-amber-800/60 rounded-lg text-[11px] text-amber-300 max-w-[280px]">
                Tip: In-app browsers often restrict camera access. Tap the menu (⋮) and select{' '}
                <b>"Open in Chrome"</b>.
              </div>
            )}

            <div className="flex items-center gap-2">
              {errorInfo.canRetry && (
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Retry Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-t border-slate-800 text-xs">
        {/* Stop Camera Button */}
        <button
          type="button"
          onClick={() => {
            stopScanner();
            onClose();
          }}
          disabled={status === 'STOPPING'}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <CameraOff size={14} />
          <span>Stop Camera</span>
        </button>

        {/* Action Controls (Torch & Switch Camera) */}
        <div className="flex items-center gap-2">
          {/* Torch Toggle */}
          {hasTorch && status === 'SCANNING' && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
            >
              {isTorchOn ? <Zap size={15} /> : <ZapOff size={15} />}
            </button>
          )}

          {/* Switch Camera Button (Rear vs Front) */}
          {availableCameras.length > 1 && status === 'SCANNING' && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Switch Camera (Rear/Front)"
            >
              <SwitchCamera size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
