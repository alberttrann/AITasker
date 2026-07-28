import { Clock, LockKeyhole } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { formatVND } from '@/lib/utils';
import type { BidOfferDto } from '@/types/api.types';

export default function AcceptedOfferSummary({
  offer,
  termsAcceptedAt,
}: {
  offer?: BidOfferDto;
  termsAcceptedAt?: string;
}) {
  if (!offer) return null;
  const total = offer.milestones.reduce((sum, milestone) => sum + (milestone.price_vnd ?? 0), 0);

  return (
    <Card className="shrink-0 border-emerald-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-emerald-600" /><h2 className="text-sm font-semibold text-slate-900">Accepted offer v{offer.version}</h2></div>
          <strong className="font-mono text-sm text-emerald-700">{formatVND(total)}</strong>
        </div>
        <div className="grid gap-2 grid-cols-1 max-h-60 overflow-y-auto pr-1">
          {offer.milestones.map((milestone) => (
            <div key={milestone.milestone_number} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-800 leading-snug">M{milestone.milestone_number}. {milestone.deliverable_statement}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{formatVND(milestone.price_vnd ?? 0)}</span>
                {milestone.estimated_duration_days ? <span className="inline-flex items-center gap-1"><Clock size={11} />{milestone.estimated_duration_days} days</span> : null}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{milestone.criteria?.length || 0} acceptance criteria</p>
            </div>
          ))}
        </div>
        {termsAcceptedAt ? <p className="text-[11px] text-slate-500">Terms locked on {new Date(termsAcceptedAt).toLocaleString('en-GB')}</p> : null}
      </CardContent>
    </Card>
  );
}
