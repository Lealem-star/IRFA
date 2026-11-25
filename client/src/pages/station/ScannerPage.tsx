import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VerificationResultData, FuelTransaction } from '../../types';
import { ScannerCameraView } from './scanner/ScannerCameraView';
import { ScannerAuthorizedView } from './scanner/ScannerAuthorizedView';
import { ScannerRejectedView } from './scanner/ScannerRejectedView';
import { ScannerDispenseView } from './scanner/ScannerDispenseView';
import { ScannerReceiptView } from './scanner/ScannerReceiptView';
import { ScannerManualModal } from './scanner/ScannerManualModal';
import { ScannerDemoModal } from './scanner/ScannerDemoModal';
import { Loader2 } from 'lucide-react';

export type StationWorkflowStep =
  | 'SCANNING'
  | 'VERIFYING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'DISPENSING'
  | 'RECEIPT';

export const ScannerPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Workflow Step State Machine
  const [step, setStep] = useState<StationWorkflowStep>('SCANNING');

  // Verification Data
  const [verifiedData, setVerifiedData] = useState<VerificationResultData | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [attemptedCode, setAttemptedCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Dispensing & Transaction Data
  const [isDispenseSubmitting, setIsDispenseSubmitting] = useState<boolean>(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<FuelTransaction | null>(null);
  const [remainingAfter, setRemainingAfter] = useState<number>(0);

  // Modal Dialogs
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const stationName = user?.fuelStation?.name || 'Tana Energy Fuel Station';
  const stationCode = user?.fuelStation?.code || 'BD-ST-01';

  // Execute verification against existing backend endpoint
  const executeVerification = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;

    setAttemptedCode(codeToVerify.trim());
    setIsVerifying(true);
    setStep('VERIFYING');
    setIsManualModalOpen(false);
    setIsDemoModalOpen(false);

    try {
      const res = await api.post('/verification/verify', {
        qrTokenOrCode: codeToVerify.trim(),
      });

      if (res.data.success && res.data.verified) {
        setVerifiedData(res.data.data);
        setStep('AUTHORIZED');
      } else {
        setRejectionReason(res.data.rejectionReason || 'Record not eligible for fuel access.');
        setStep('REJECTED');
      }
    } catch (err: any) {
      const reason =
        err.response?.data?.rejectionReason ||
        err.response?.data?.message ||
        'Verification failed: Record not recognized or ineligible.';
      setRejectionReason(reason);
      setStep('REJECTED');
    } finally {
      setIsVerifying(false);
    }
  };

  // Execute dispensing transaction against existing backend endpoint
  const executeDispense = async (quantityLiters: number, notes: string) => {
    if (!verifiedData) return;

    setIsDispenseSubmitting(true);
    setDispenseError(null);

    try {
      const res = await api.post('/transactions/dispense', {
        authorizationId: verifiedData.authorization.id,
        quantityLiters,
        notes,
      });

      if (res.data.success) {
        setReceiptData(res.data.receipt);
        setRemainingAfter(res.data.remainingBalance);
        setStep('RECEIPT');
      }
    } catch (err: any) {
      setDispenseError(err.response?.data?.message || 'Dispensing transaction failed. Please retry.');
    } finally {
      setIsDispenseSubmitting(false);
    }
  };

  // Reset all state to immediately start scanning the next farmer
  const resetToNextFarmer = () => {
    setVerifiedData(null);
    setRejectionReason(null);
    setAttemptedCode('');
    setDispenseError(null);
    setReceiptData(null);
    setRemainingAfter(0);
    setStep('SCANNING');
  };

  return (
    <div className="w-full flex-1 flex flex-col min-w-0 bg-gov-bg">
      {/* 1. STEP: SCANNING (Camera View) */}
      {step === 'SCANNING' && (
        <ScannerCameraView
          stationName={stationName}
          stationCode={stationCode}
          onScanSuccess={executeVerification}
          onOpenManualEntry={() => setIsManualModalOpen(true)}
          onOpenDemoMenu={() => setIsDemoModalOpen(true)}
          onExit={() => navigate('/dashboard')}
        />
      )}

      {/* 2. STEP: VERIFYING (Clean Full-Screen Loading HUD) */}
      {step === 'VERIFYING' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[460px]">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 shadow-sm animate-pulse">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Verifying Farmer Identity & Quota...
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
            Checking 8-step compliance rules against Bahir Dar Agriculture central ledger.
          </p>
          <div className="mt-3 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-mono text-slate-600">
            {attemptedCode}
          </div>
        </div>
      )}

      {/* 3. STEP: AUTHORIZED (Dedicated Success Screen) */}
      {step === 'AUTHORIZED' && verifiedData && (
        <ScannerAuthorizedView
          data={verifiedData}
          onContinueToDispense={() => setStep('DISPENSING')}
          onCancelScan={resetToNextFarmer}
        />
      )}

      {/* 4. STEP: REJECTED (Dedicated Rejection Screen) */}
      {step === 'REJECTED' && (
        <ScannerRejectedView
          rejectionReason={rejectionReason || 'Fuel request rejected by system.'}
          attemptedCode={attemptedCode}
          onScanAnother={resetToNextFarmer}
          onOpenManualEntry={() => setIsManualModalOpen(true)}
        />
      )}

      {/* 5. STEP: DISPENSING (Dedicated Dispensing Form) */}
      {step === 'DISPENSING' && verifiedData && (
        <ScannerDispenseView
          data={verifiedData}
          onSubmitDispense={executeDispense}
          onCancel={() => setStep('AUTHORIZED')}
          isSubmitting={isDispenseSubmitting}
          submissionError={dispenseError}
        />
      )}

      {/* 6. STEP: RECEIPT (Dedicated Official Receipt Screen) */}
      {step === 'RECEIPT' && receiptData && (
        <ScannerReceiptView
          receipt={receiptData}
          remainingLiters={remainingAfter}
          operatorUsername={user?.username}
          onScanNext={resetToNextFarmer}
        />
      )}

      {/* Manual Verification Modal Dialog */}
      <ScannerManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={executeVerification}
        isLoading={isVerifying}
      />

      {/* Demo Shortcuts Modal Dialog */}
      <ScannerDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSelectFarmer={executeVerification}
      />
    </div>
  );
};
