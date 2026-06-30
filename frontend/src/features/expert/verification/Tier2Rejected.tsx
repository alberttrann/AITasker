import React from 'react';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Tier2RejectedProps {
  seamCode: string;
  llmConfidence: number;
  advisoryNote: string | null;
  attemptsRemaining: number;
  onRetry: () => void;
  onClose: () => void;
}

export default function Tier2Rejected({ 
  seamCode, 
  llmConfidence, 
  advisoryNote, 
  attemptsRemaining, 
  onRetry, 
  onClose 
}: Tier2RejectedProps) {
  const percentage = Math.round(llmConfidence * 100);

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-6 bg-white rounded-2xl shadow-sm border border-red-100 text-center animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-center mb-6">
        <XCircle className="w-24 h-24 text-red-500" strokeWidth={1.5} />
      </div>
      
      <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Evidence Insufficient</h2>
      <p className="text-gray-600 text-lg mb-8">
        Your portfolio for seam <span className="font-bold text-gray-900">{seamCode}</span> did not meet the Tier 2 threshold.
      </p>

      <div className="bg-red-50 border border-red-100 rounded-xl p-6 mb-6 text-left">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold text-red-800 uppercase tracking-wider">AI Confidence Score</span>
          <span className="text-2xl font-black text-red-700">{percentage}%</span>
        </div>
        
        {advisoryNote && (
          <div className="bg-white p-4 rounded-lg border border-red-100">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Advisory Note</h4>
            <p className="text-gray-800 text-sm">{advisoryNote}</p>
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-orange-600 mb-8 bg-orange-50 py-2 px-4 rounded-full inline-block">
        You have {attemptsRemaining} attempts remaining for this seam.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onClose}
          className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>
        <button
          onClick={onRetry}
          disabled={attemptsRemaining <= 0}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-transform active:scale-95 shadow-sm"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
