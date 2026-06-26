import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function Stage4Submitted() {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto text-center py-16 px-6 bg-surface rounded-lg shadow-md border border-slate-200 my-12 font-body">
      {/* Checkmark Status Circle */}
      <div className="w-16 h-16 bg-success/10 text-success flex items-center justify-center rounded-full mx-auto mb-6 text-3xl font-bold">
        <Check className="w-8 h-8" />
      </div>

      <h2 className="text-h3 font-bold text-primary mb-3 font-headline">
        Technical Context Submitted!
      </h2>
      
      <p className="text-secondary text-body-sm leading-relaxed mb-4">
        Your organization's infrastructure detail has been safely processed and logged in the platform's decision systems.
      </p>
      
      <p className="text-secondary text-caption leading-relaxed mb-8">
        Once the CEO publishes and funds the milestones, you will gain access to verify deliverables, review active bidding documentation, and manage security schemas.
      </p>

      {/* Redirect back */}
      <button
        onClick={() => navigate('/tech-team')}
        className="w-full h-[46px] bg-primary text-surface rounded font-semibold text-body-sm hover:bg-primary-dark transition-all shadow-sm"
      >
        Go to Dashboard
      </button>
    </div>
  );
}