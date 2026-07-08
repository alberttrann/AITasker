import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, Wrench } from 'lucide-react';

export default function BankHubLink() {
  const navigate = useNavigate();

  return (
    <div className="py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/expert/wallet')}
          className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Landmark className="text-slate-500" size={24} />
          Link Bank Account
        </h1>
      </div>

      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <Wrench size={32} className="text-blue-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Feature in Development
          </h2>
          <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
            The ability to link a bank account via SePay Bank Hub is currently being built. Please check back later!
          </p>
          <button
            onClick={() => navigate('/expert/wallet')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all hover:shadow-md active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            Back to Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
