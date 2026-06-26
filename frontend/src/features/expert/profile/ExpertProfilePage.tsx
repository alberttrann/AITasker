import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import ProfileBuilder from './ProfileBuilder';
import PortfolioSubmitForm from '../verification/PortfolioSubmitForm';
import { ShieldCheck, PlusCircle, CheckCircle, Edit3, ArrowUpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ExpertProfilePage() {
  const { profile, isLoadingProfile } = useExpertProfile();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (isLoadingProfile) {
    return (
      <div className="w-full max-w-5xl mx-auto py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  const hasClaimedProfile = profile && (profile.domainDepths?.length > 0 || profile.seamClaims?.length > 0 || profile.profile?.stackTagsJson?.length > 0);

  if (isBuilding) {
    return <ProfileBuilder onCancel={() => setIsBuilding(false)} />;
  }

  if (isVerifying) {
    return (
      <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6 flex justify-end">
          <Button variant="outline" onClick={() => setIsVerifying(false)} className="flex items-center gap-2">
            <X className="w-4 h-4" /> Back to Profile
          </Button>
        </div>
        <PortfolioSubmitForm />
      </div>
    );
  }

  if (!hasClaimedProfile) {
    return (
      <div className="w-full max-w-5xl mx-auto py-16 px-4 sm:px-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Expert Profile Not Claimed</h1>
        <p className="text-gray-500 text-lg max-w-5xl mb-8">
          You haven't built your expert profile yet. Define your domains, integration seams, and tech stack to get matched with high-value AI projects.
        </p>
        <Button 
          onClick={() => setIsBuilding(true)} 
          variant="primary" 
          className="py-4 px-8 text-lg flex items-center gap-2 rounded-xl shadow-lg hover:shadow-blue-500/20"
        >
          <PlusCircle className="w-5 h-5" />
          Build Your Profile Now
        </Button>
      </div>
    );
  }

  // They HAVE claimed it, show the summary.
  const domains = profile.domainDepths || [];
  const seams = profile.seamClaims || [];
  const stackTags = profile.profile?.stackTagsJson || [];
  const engagementModel = profile.profile?.engagementModel || 'MILESTONE';

  const getDomainLabel = (code: string) => {
    const map: Record<string, string> = {
      'A': 'LLM App Engineering',
      'B': 'Applied Reasoning Systems',
      'C': 'Prompt Engineering & Design',
      'D': 'Model Fine-Tuning & Training',
      'E': 'RAG & Search Architecture',
      'F': 'MLOps & Production AI',
    };
    return map[code] || code;
  };

  const getSeamLabel = (code: string) => {
    const map: Record<string, string> = {
      'A↔B': 'Applied Agents',
      'A↔C': 'Prompt Engineering Apps',
      'A↔D': 'Fine-Tuned Apps',
      'A↔F': 'Production LLMs',
      'B↔E': 'Agents with Memory',
      'C↔E': 'Retrieval Prompting',
      'C↔F': 'PromptOps',
      'D↔E': 'Fine-Tuned RAG',
      'D↔F': 'MLOps for LLMs',
      'E↔F': 'Scalable RAG',
    };
    return map[code] || code;
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-10 h-10 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Your Expert Profile</h1>
            <p className="text-gray-500 mt-1">This is how you appear to CEOs and project matchers.</p>
          </div>
        </div>
        <Button onClick={() => setIsBuilding(true)} variant="outline" className="flex items-center gap-2 bg-white">
          <Edit3 className="w-4 h-4" />
          Edit Profile
        </Button>
      </div>

      <div className="space-y-6">
        {/* Domains Review */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h4 className="font-extrabold text-lg text-gray-900 mb-4 border-b pb-2">Domain Expertise</h4>
          {domains.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No domains selected.</p>
          ) : (
            <div className="grid gap-3">
              {domains.map((d: any) => (
                <div key={d.domainCode} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700">{d.domainCode} · {getDomainLabel(d.domainCode)}</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full">{d.depthLevel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Seams Review */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h4 className="font-extrabold text-lg text-gray-900">Seam Claims</h4>
            {seams.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                onClick={() => setIsVerifying(true)}
              >
                <ArrowUpCircle className="w-4 h-4" /> Verify a Seam
              </Button>
            )}
          </div>
          {seams.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No seams selected.</p>
          ) : (
            <div className="grid gap-3">
              {seams.map((s: any) => (
                <div key={s.seamCode || s.code} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-800 font-bold text-xs rounded border">{s.seamCode || s.code}</span>
                  <span className="font-medium text-gray-700">{getSeamLabel(s.seamCode || s.code)}</span>
                  {s.verificationTier === 'VERIFIED' && (
                    <span className="ml-auto px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Tier 2 Verified
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stack & Model Review */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-500 block mb-3 uppercase tracking-wider">Tech Stack</span>
            {stackTags.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No stack tags specified.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stackTags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-full text-sm font-medium border border-slate-200 shadow-sm">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="md:w-64 md:border-l md:pl-8">
            <span className="text-sm font-semibold text-gray-500 block mb-2 uppercase tracking-wider">Engagement Model</span>
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold">
              {engagementModel.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
