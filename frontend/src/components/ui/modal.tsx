import React from 'react';

interface Modal {
  isOpen: boolean;
  onClose: () => void;
  // Passing in some mock data for the blueprint section
  blueprintDetails?: {
    id: string;
    title: string;
    amount: number;
    deliverables: string[];
  };
}

export function QrPopUp({
  isOpen,
  onClose,
  blueprintDetails = {
    id: "ENG-8472-M1",
    title: "Phase 1: Database Architecture",
    amount: 15000000,
    deliverables: ["Schema Design", "PostgreSQL Setup", "API Endpoints"],
  }
}: Modal) {
  if (!isOpen) return null;

  // Format currency
  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(blueprintDetails.amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-dark/80 p-4 backdrop-blur-md transition-all duration-300">
      {/* Modal Container */}
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[32px] bg-surface-card shadow-lg animate-in fade-in zoom-in-95 duration-300">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary-bg text-primary-dark hover:bg-coral hover:text-white hover:shadow-coral-glow transition-all duration-300 active:scale-95"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Two-column layout grid */}
        <div className="flex flex-col md:flex-row">
          
          {/* LEFT COLUMN: The Blueprint Details */}
          <div className="flex-1 bg-surface-card p-6 md:p-8 border-b md:border-b-0 md:border-r-4 border-dashed border-primary-light/30 border-l-[6px] border-l-primary-light">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-accent text-primary-dark font-headline text-xs rounded-[8px] mb-3 shadow-sm">
                Escrow Blueprint
              </span>
              <h2 className="font-headline text-h3 text-primary-dark mb-2">
                {blueprintDetails.title}
              </h2>
              <p className="font-body text-sm text-primary-dark/70 font-mono bg-primary-bg inline-block px-2 py-1 rounded">
                Ref: {blueprintDetails.id}
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-primary-bg p-4 rounded-[16px] border border-primary/20">
                <p className="font-headline text-xs text-primary-dark/80 mb-1 uppercase tracking-wider">Total Amount Due</p>
                <p className="font-headline text-h2 text-primary drop-shadow-sm">
                  {formattedAmount}
                </p>
              </div>
              
              <div className="pt-4 border-t-2 border-dashed border-primary-light/30">
                <p className="font-headline text-sm text-primary-dark mb-3">Deliverables:</p>
                <ul className="space-y-3">
                  {blueprintDetails.deliverables.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 font-body text-body text-primary-dark/90 bg-cream p-3 rounded-[12px] border border-accent-light/50">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary-dark shadow-sm">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="mt-0.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <p className="font-body text-xs text-primary-dark/60 bg-primary-bg p-3 rounded-[12px] flex items-center gap-2">
              <span className="text-xl">🔒</span>
              Funds will be securely held in escrow until all deliverables are verified and signed off.
            </p>
          </div>

          {/* RIGHT COLUMN: The QR Code */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 bg-surface-base relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-accent-light/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-primary-light/20 rounded-full blur-2xl"></div>

            <div className="text-center mb-6 relative z-10">
              <h3 className="font-headline text-h3 text-primary-dark mb-2 inline-flex items-center gap-2">
                Scan to Fund
              </h3>
              <p className="font-body text-sm text-primary-dark/80 bg-white/50 px-3 py-1 rounded-full">
                Open your banking app to complete the deposit.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="mb-6 flex aspect-square w-[240px] items-center justify-center rounded-[24px] bg-white p-4 shadow-card border-2 border-primary-light relative z-10 group hover:shadow-teal-glow transition-all duration-300">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[26px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex h-full w-full items-center justify-center rounded-[16px] border-2 border-dashed border-primary-light/50 bg-primary-bg group-hover:border-primary transition-colors">
                <div className="text-center">
                  <span className="inline-block text-4xl mb-2 animate-bounce">📱</span>
                  <br/>
                  <span className="text-primary-dark font-headline text-sm px-4">
                    QR Component<br/>Goes Here
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Logo area */}
            <div className="flex items-center gap-3 text-primary-dark relative z-10 bg-white/60 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm">
              <div className="h-8 w-8 rounded-[8px] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-headline text-xs shadow-md">
                AI
              </div>
              <span className="font-headline text-sm tracking-wider">AITasker Pay</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}