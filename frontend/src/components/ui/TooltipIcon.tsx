import { Info } from 'lucide-react';
import { useState } from 'react';

export default function TooltipIcon({ text }: { text?: string | null }) {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-white text-slate-700 border border-slate-200 text-xs leading-relaxed rounded-lg shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-200 text-center">
          {text || "No description provided."}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-white drop-shadow-sm"></div>
        </div>
      )}
    </div>
  );
}
