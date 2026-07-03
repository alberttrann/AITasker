import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FootprintAlignment as FootprintAlignmentData } from '@/types/jsonb.types';

// ⚠️ Wire format uses '<->' — FE enums use '↔'
export const toWireSeam = (feCode: string) => feCode.replace(/↔/g, '<->');
export const toFeSeam = (wireCode: string) => wireCode.replace(/<->/g, '↔');

/** Convert FE seam codes (↔) to wire format (<->) for POST /bids */
export function toWireFootprint(data: FootprintAlignmentData) {
  return {
    domains: data.domains,
    seams: data.seams.map((s) => ({ ...s, code: toWireSeam(s.code) })),
  };
}

const ALL_DOMAINS: { code: string; label: string }[] = [
  { code: 'A', label: 'LLM Application Engineering' },
  { code: 'B', label: 'MLOps / LLMOps' },
  { code: 'C', label: 'AI Evaluation & Quality' },
  { code: 'D', label: 'Vector DB & Embeddings' },
  { code: 'E', label: 'Data & Pipeline Engineering' },
  { code: 'F', label: 'ML Modeling & Fine-Tuning' },
];

const ALL_SEAMS: { code: string; label: string }[] = [
  { code: 'A↔C', label: 'A ↔ C — LLM ↔ Evaluation' },
  { code: 'A↔F', label: 'A ↔ F — LLM ↔ Modeling' },
  { code: 'A↔D', label: 'A ↔ D — LLM ↔ Vector DB' },
  { code: 'D↔E', label: 'D ↔ E — Vector DB ↔ Data' },
  { code: 'D↔F', label: 'D ↔ F — Vector DB ↔ Modeling' },
  { code: 'C↔F', label: 'C ↔ F — Evaluation ↔ Modeling' },
  { code: 'E↔F', label: 'E ↔ F — Data ↔ Modeling' },
  { code: 'A↔B', label: 'A ↔ B — LLM ↔ MLOps' },
  { code: 'B↔E', label: 'B ↔ E — MLOps ↔ Data' },
  { code: 'C↔E', label: 'C ↔ E — Evaluation ↔ Data' },
];

export default function FootprintAlignment({
  expertProfile,
  project,
}: FootprintAlignmentProps) {
  const expertDomains = expertProfile?.domainDepths || [];
  const expertSeams = expertProfile?.seamClaims || [];
  
  const projectDomains = project?.requiredDomainsJson || project?.required_domains_json || [];
  const projectSeams = project?.requiredSeamsJson || project?.required_seams_json || [];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-headline text-[14px] font-medium text-[#0F172A]">
          Footprint Alignment
        </h4>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          How your verified capabilities compare to the project's required footprint.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Requirements Column */}
        <div className="space-y-4">
          <div className="border-b border-[#E2E8F0] pb-2">
            <h5 className="font-headline text-[13px] font-semibold text-[#0F172A] uppercase tracking-wider">
              Project Requirements
            </h5>
          </div>
          
          <div className="space-y-3">
            <h6 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">Domains</h6>
            {projectDomains.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] italic">No specific domains required.</p>
            ) : (
              projectDomains.map((req: any) => {
                const code = req.domainCode || req.domain_code;
                const match = expertDomains.find((d: any) => d.domainCode === code);
                const info = ALL_DOMAINS.find(d => d.code === code);
                return (
                  <div key={code} className={cn("p-2 rounded-lg border text-[13px]", match ? "border-[#059669]/30 bg-[#059669]/5" : "border-[#E2E8F0] bg-white")}>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-[#0F172A]">{code} - {info?.label || code}</span>
                      {match ? <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" /> : <XCircle className="w-4 h-4 text-[#94A3B8] shrink-0" />}
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-1">Required: {req.requiredDepth || req.required_depth || 'ANY'}</div>
                  </div>
                )
              })
            )}

            <h6 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mt-4">Seams</h6>
            {projectSeams.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] italic">No specific seams required.</p>
            ) : (
              projectSeams.map((req: any) => {
                const code = req.seamCode || req.seam_code;
                const match = expertSeams.find((s: any) => (s.seamCode || s.code) === code);
                const info = ALL_SEAMS.find(s => s.code === code);
                return (
                  <div key={code} className={cn("p-2 rounded-lg border text-[13px]", match ? "border-[#059669]/30 bg-[#059669]/5" : "border-[#E2E8F0] bg-white")}>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-[#0F172A]">{info?.label || code}</span>
                      {match ? <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" /> : <XCircle className="w-4 h-4 text-[#94A3B8] shrink-0" />}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Expert Profile Column */}
        <div className="space-y-4">
          <div className="border-b border-[#E2E8F0] pb-2">
            <h5 className="font-headline text-[13px] font-semibold text-[#0F172A] uppercase tracking-wider">
              Your Profile
            </h5>
          </div>
          
          <div className="space-y-3">
            <h6 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">Domains</h6>
            {expertDomains.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] italic">No domains configured.</p>
            ) : (
              expertDomains.map((exp: any) => {
                const code = exp.domainCode;
                const match = projectDomains.find((d: any) => (d.domainCode || d.domain_code) === code);
                const info = ALL_DOMAINS.find(d => d.code === code);
                return (
                  <div key={code} className={cn("p-2 rounded-lg border text-[13px]", match ? "border-[#059669] bg-[#059669]/10 shadow-sm ring-1 ring-[#059669]/20" : "border-[#E2E8F0] bg-white")}>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-[#0F172A]">{code} - {info?.label || code}</span>
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-1">Depth: {exp.depthLevel}</div>
                  </div>
                )
              })
            )}

            <h6 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mt-4">Seams</h6>
            {expertSeams.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] italic">No seams configured.</p>
            ) : (
              expertSeams.map((exp: any) => {
                const code = exp.seamCode || exp.code;
                const match = projectSeams.find((s: any) => (s.seamCode || s.seam_code) === code);
                const info = ALL_SEAMS.find(s => s.code === code);
                return (
                  <div key={code} className={cn("p-2 rounded-lg border text-[13px]", match ? "border-[#059669] bg-[#059669]/10 shadow-sm ring-1 ring-[#059669]/20" : "border-[#E2E8F0] bg-white")}>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-[#0F172A]">{info?.label || code}</span>
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-1">Tier: {exp.verificationTier || 'CLAIMED'}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
