import React from "react";
import { Award, CheckCircle, RefreshCcw, ArrowLeft } from "lucide-react";

interface Tier2SuccessProps {
  seamCode: string;
  llmConfidence: number;
  onClose: () => void;
  onSubmitAnother: () => void;
}

export default function Tier2Success({
  seamCode,
  llmConfidence,
  onClose,
  onSubmitAnother,
}: Tier2SuccessProps) {
  const percentage = Math.round(llmConfidence * 100);

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-6 bg-white rounded-2xl shadow-sm border border-emerald-100 text-center animate-in zoom-in-95 duration-300">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <Award className="w-24 h-24 text-emerald-500" strokeWidth={1.5} />
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1">
            <CheckCircle className="w-8 h-8 text-emerald-600 bg-white rounded-full" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
        Verification Successful!
      </h2>
      <p className="text-gray-600 text-lg mb-6">
        Your portfolio for seam{" "}
        <span className="font-bold text-gray-900">{seamCode}</span> has been
        approved.
      </p>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 mb-8 max-w-2sm mx-auto">
        <p className="text-sm text-emerald-800 font-semibold uppercase tracking-wider mb-2">
          AI Evaluation Confidence
        </p>
        <div className="text-4xl font-black text-emerald-600">
          {percentage}%
        </div>
        <p className="text-emerald-700 text-xs mt-2">
          Exceeds the 85% threshold for Tier 2.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onClose}
          className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>
        <button
          onClick={onSubmitAnother}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-transform active:scale-95 shadow-sm"
        >
          <RefreshCcw className="w-5 h-5" />
          Submit Another
        </button>
      </div>
    </div>
  );
}
