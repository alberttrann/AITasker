import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';

interface VerificationLockoutProps {
  seamCode: string;
  seamName?: string;
  lockedUntil: string;
  onClose: () => void;
}

export default function VerificationLockout({ seamCode, seamName, lockedUntil, onClose }: VerificationLockoutProps) {
  const date = new Date(lockedUntil);
  const formattedDate = date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-6 bg-white rounded-2xl shadow-sm border border-gray-200 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 p-6 rounded-full">
          <Lock className="w-16 h-16 text-gray-500" strokeWidth={2} />
        </div>
      </div>
      
      <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-4">Verification Locked</h2>
      <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
        You have reached the maximum number of attempts for seam <span className="font-bold text-gray-900">{seamName || seamCode}</span>.
      </p>

      <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 mb-8 inline-block text-left">
        <p className="text-sm font-semibold text-orange-800 uppercase tracking-wider mb-1">Locked Until</p>
        <p className="text-lg font-bold text-orange-900">{formattedDate}</p>
      </div>

      <div>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>
      </div>
    </div>
  );
}
