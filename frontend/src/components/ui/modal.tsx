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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {/* Modal Container - Made wider (max-w-[720px]) to fit both sections */}
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Two-column layout grid */}
        <div className="flex flex-col md:flex-row">
          
          {/* LEFT COLUMN: The Blueprint Details */}
          <div className="flex-1 bg-surface-container-low p-md sm:p-lg border-b md:border-b-0 md:border-r border-outline-variant">
            <div className="mb-md">
              <span className="inline-block px-2 py-1 bg-primary-container text-on-primary-container font-label-sm text-xs rounded-md mb-2">
                Escrow Blueprint
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">
                {blueprintDetails.title}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                Ref: {blueprintDetails.id}
              </p>
            </div>

            <div className="space-y-sm mb-lg">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Total Amount Due</p>
                <p className="font-headline-md text-headline-md text-primary font-bold">
                  {formattedAmount}
                </p>
              </div>
              
              <div className="pt-sm border-t border-outline-variant">
                <p className="font-label-sm text-label-sm text-on-surface mb-2">Deliverables:</p>
                <ul className="space-y-2">
                  {blueprintDetails.deliverables.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant">
                      <svg className="h-4 w-4 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <p className="font-body-xs text-xs text-on-surface-variant italic">
              Funds will be securely held in escrow until all deliverables are verified and signed off.
            </p>
          </div>

          {/* RIGHT COLUMN: The QR Code */}
          <div className="flex-1 flex flex-col items-center justify-center p-md sm:p-lg bg-surface">
            <div className="text-center mb-md">
              <h3 className="font-label-lg text-label-lg text-on-surface mb-1">
                Scan to Fund
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Open your banking app to complete the deposit.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="mb-md flex aspect-square w-[220px] items-center justify-center rounded-xl bg-white p-3 shadow-sm border border-outline-variant">
              {/* Replace this div with actual <QRCode /> component */}
              <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-lowest">
                <span className="text-on-surface-variant font-label-sm text-sm text-center px-4">
                  QR Component<br/>Goes Here
                </span>
              </div>
            </div>

            {/* Footer Logo area */}
            <div className="flex items-center gap-2 text-on-surface-variant grayscale opacity-70">
              <div className="h-6 w-6 rounded-md bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
                AI
              </div>
              <span className="font-label-md text-label-md font-bold text-on-surface">AITasker Pay</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}