import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DomainCode, DepthLevel, SeamCode, VerificationTier } from '@/types/enums';

// ⚠️ Wire format uses '<->' — FE enums use '↔'
const toWireSeam = (feCode: string) => feCode.replace(/↔/g, '<->');
const toFeSeam = (wireCode: string) => wireCode.replace(/<->/g, '↔');

export interface DomainEntry {
  code: DomainCode;
  depth: DepthLevel;
}

export interface SeamEntry {
  code: SeamCode | string;
  tier: VerificationTier;
}

export interface FootprintAlignmentData {
  domains: DomainEntry[];
  seams: SeamEntry[];
}

interface FootprintAlignmentProps {
  data: FootprintAlignmentData;
  onChange: (data: FootprintAlignmentData) => void;
  errors?: { domains?: string; seams?: string };
  disabled?: boolean;
  /** Pre-fill from expert profile */
  profileDefaults?: FootprintAlignmentData;
}

const ALL_DOMAINS: { code: DomainCode; label: string }[] = [
  { code: 'A', label: 'LLM Application Engineering' },
  { code: 'B', label: 'MLOps / LLMOps' },
  { code: 'C', label: 'AI Evaluation & Quality' },
  { code: 'D', label: 'Vector DB & Embeddings' },
  { code: 'E', label: 'Data & Pipeline Engineering' },
  { code: 'F', label: 'ML Modeling & Fine-Tuning' },
];

const DEPTH_LEVELS: DepthLevel[] = ['SURFACE', 'OPERATIONAL', 'DEEP'];

const ALL_SEAMS: { code: SeamCode; label: string }[] = [
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

const TIER_LABELS: Record<VerificationTier, string> = {
  CLAIMED: 'Claimed',
  EVIDENCE_BACKED: 'Evidence-Backed',
};

export default function FootprintAlignment({
  data,
  onChange,
  errors = {},
  disabled = false,
}: FootprintAlignmentProps) {
  const [activeTab, setActiveTab] = useState<'domains' | 'seams'>('domains');

  const toggleDomain = (code: DomainCode) => {
    const existing = data.domains.find((d) => d.code === code);
    if (existing) {
      onChange({ ...data, domains: data.domains.filter((d) => d.code !== code) });
    } else {
      onChange({ ...data, domains: [...data.domains, { code, depth: 'OPERATIONAL' }] });
    }
  };

  const setDomainDepth = (code: DomainCode, depth: DepthLevel) => {
    onChange({
      ...data,
      domains: data.domains.map((d) => (d.code === code ? { ...d, depth } : d)),
    });
  };

  const toggleSeam = (code: SeamCode) => {
    const existing = data.seams.find((s) => s.code === code);
    if (existing) {
      onChange({ ...data, seams: data.seams.filter((s) => s.code !== code) });
    } else {
      onChange({ ...data, seams: [...data.seams, { code, tier: 'CLAIMED' }] });
    }
  };

  const setSeamTier = (code: SeamCode, tier: VerificationTier) => {
    onChange({
      ...data,
      seams: data.seams.map((s) => (s.code === code ? { ...s, tier } : s)),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-headline text-[14px] font-medium text-[#0F172A]">
          Footprint Alignment
          <span className="ml-1 text-[#EF4444]">*</span>
        </h4>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          Select the AI domains you cover and the cross-domain seams you can bridge.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#E2E8F0]">
        {(['domains', 'seams'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            disabled={disabled}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 font-headline text-[13px] font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-[#0F172A] text-[#0F172A]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            {tab === 'domains' ? 'Domains' : 'Seams'}
            {tab === 'seams' && data.seams.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#059669]/10 px-1.5 py-0.5 text-[11px] text-[#059669]">
                {data.seams.length}
              </span>
            )}
            {tab === 'domains' && data.domains.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#059669]/10 px-1.5 py-0.5 text-[11px] text-[#059669]">
                {data.domains.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <div className="space-y-3">
          {errors.domains && (
            <p className="text-[12px] text-[#EF4444]" role="alert">{errors.domains}</p>
          )}
          {ALL_DOMAINS.map((dom) => {
            const selected = data.domains.find((d) => d.code === dom.code);
            return (
              <div
                key={dom.code}
                className={cn(
                  'rounded-[8px] border p-3 transition-colors',
                  selected
                    ? 'border-[#0F172A] bg-[#0F172A]/[0.03]'
                    : 'border-[#E2E8F0] bg-white',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleDomain(dom.code)}
                    disabled={disabled}
                    className="h-[18px] w-[18px] rounded-[4px] border-1.5 border-[#CBD5E1] accent-[#0F172A]"
                  />
                  <span className="flex-1 font-body text-[14px] text-[#0F172A]">
                    <span className="font-headline font-semibold">{dom.code}</span>
                    <span className="ml-2 text-[#64748B]">{dom.label}</span>
                  </span>
                </label>
                {selected && (
                  <div className="mt-2 ml-[26px] flex gap-2">
                    {DEPTH_LEVELS.map((depth) => (
                      <button
                        key={depth}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDomainDepth(dom.code, depth)}
                        className={cn(
                          'rounded-[4px] px-3 py-1 text-[12px] font-medium transition-colors',
                          selected.depth === depth
                            ? 'bg-[#0F172A] text-white'
                            : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
                        )}
                      >
                        {depth.charAt(0) + depth.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Seams Tab */}
      {activeTab === 'seams' && (
        <div className="space-y-3">
          {errors.seams && (
            <p className="text-[12px] text-[#EF4444]" role="alert">{errors.seams}</p>
          )}
          {ALL_SEAMS.map((seam) => {
            const selected = data.seams.find((s) => s.code === seam.code);
            return (
              <div
                key={seam.code}
                className={cn(
                  'rounded-[8px] border p-3 transition-colors',
                  selected
                    ? 'border-[#059669] bg-[#059669]/[0.04]'
                    : 'border-[#E2E8F0] bg-white',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleSeam(seam.code)}
                    disabled={disabled}
                    className="h-[18px] w-[18px] rounded-[4px] border-1.5 border-[#CBD5E1] accent-[#059669]"
                  />
                  <span className="flex-1 font-body text-[14px] text-[#0F172A]">
                    {seam.label}
                  </span>
                </label>
                {selected && (
                  <div className="mt-2 ml-[26px]">
                    <select
                      value={selected.tier}
                      onChange={(e) => setSeamTier(seam.code, e.target.value as VerificationTier)}
                      disabled={disabled}
                      className="rounded-[6px] border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
                    >
                      {(Object.entries(TIER_LABELS) as [VerificationTier, string][]).map(
                        ([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Convert FE seam codes (↔) to wire format (<->) for POST /bids */
export function toWireFootprint(data: FootprintAlignmentData) {
  return {
    domains: data.domains,
    seams: data.seams.map((s) => ({ ...s, code: toWireSeam(s.code) })),
  };
}

export { toWireSeam, toFeSeam };
