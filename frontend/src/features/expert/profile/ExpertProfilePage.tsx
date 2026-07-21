import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import ProfileBuilder from './ProfileBuilder';
import PortfolioSubmitForm from '../verification/PortfolioSubmitForm';
import { ArrowUpCircle, X, Lock, AlertTriangle, ArrowLeft, CheckCircle, Edit3, History } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import TooltipIcon from '@/components/ui/TooltipIcon';
import { useNavigate } from 'react-router-dom';
import { useDomains, useSeams } from '@/hooks/use-config';

export default function ExpertProfilePage() {
  const { profile, isLoadingProfile } = useExpertProfile();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();

  const { data: dynamicDomains } = useDomains();
  const { data: dynamicSeams } = useSeams();

  if (isLoadingProfile) {
    return (
      <div className="w-full max-w-[1440px] mx-auto py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <Spinner size="lg" className="mb-4" />
        <p className="text-gray-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  if (isBuilding) {
    return <ProfileBuilder onCancel={() => setIsBuilding(false)} />;
  }

  if (isVerifying) {
    return (
      <div className="w-full max-w-[1440px] mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6 flex justify-end">
          <Button variant="outline" onClick={() => setIsVerifying(false)} className="flex items-center gap-2">
            <X className="w-4 h-4" /> Back to Profile
          </Button>
        </div>
        <PortfolioSubmitForm />
      </div>
    );
  }

  // Ensure profile properties exist before accessing
  const domains = profile?.domainDepths || [];
  const seams = profile?.seamClaims || [];
  const stackTags = profile?.profile?.stackTagsJson || [];
  const engagementModel = profile?.profile?.engagementModel || 'MILESTONE';
  const bio = profile?.profile?.bio || '';

  const getDomainLabel = (code: string) => {
    const domain = dynamicDomains?.find(d => d.code === code);
    return domain ? domain.name : code;
  };

  const getDomainDescription = (code: string) => {
    const domain = dynamicDomains?.find(d => d.code === code);
    return domain?.description;
  };

  const getSeamLabel = (code: string) => {
    const seam = dynamicSeams?.find(s => s.code === code);
    return seam ? seam.name : code;
  };

  const getSeamDescription = (code: string) => {
    const seam = dynamicSeams?.find(s => s.code === code);
    return seam?.description;
  };

  const missingDomains = domains.length === 0;
  const missingSeams = seams.length === 0;
  const missingStack = stackTags.length === 0;
  const missingBio = !bio;
  
  const missingParts = [];
  if (missingDomains) missingParts.push('Domain Expertise');
  if (missingSeams) missingParts.push('Seam Claims');
  if (missingStack) missingParts.push('Tech Stack');
  if (missingBio) missingParts.push('Professional Bio');

  return (
    <div className="w-full max-w-[1440px] mx-auto py-12 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
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

      {missingParts.length > 0 && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-amber-800 font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Incomplete Profile
            </h3>
            <p className="text-amber-700 text-sm mt-1">
              Your profile is missing the following sections: <span className="font-semibold">{missingParts.join(', ')}</span>.
              Completing your profile significantly increases your chances of matching with high-value projects.
            </p>
          </div>
          <Button onClick={() => setIsBuilding(true)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold border-none shrink-0 shadow-sm transition-colors">
            Complete Profile
          </Button>
        </div>
      )}

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
                  <span className="font-medium text-gray-700 flex items-center gap-2">
                    {d.domainCode} &middot; {getDomainLabel(d.domainCode)}
                    <TooltipIcon text={getDomainDescription(d.domainCode)} />
                  </span>
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
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-slate-600 border-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                onClick={() => navigate('/expert/service/expert-profile/verification-history')}
              >
                <History className="w-4 h-4" /> History
              </Button>
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
          </div>
          {seams.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No seams selected.</p>
          ) : (
            <div className="grid gap-3">
              {seams.map((s: any) => {
                const isLocked = s.lockedUntil && new Date(s.lockedUntil) > new Date();
                return (
                <div key={s.seamCode || s.code} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-800 font-bold text-xs rounded border">{s.seamCode || s.code}</span>
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      {getSeamLabel(s.seamCode || s.code)}
                      <TooltipIcon text={getSeamDescription(s.seamCode || s.code)} />
                      {(s.verificationTier === 'EVIDENCE_BACKED' || s.verificationTier === 'VERIFIED') && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                          <CheckCircle className="h-3 w-3" /> AI Verified
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:justify-end">
                    <span className="text-gray-500 font-medium">Attempts: {s.submissionCount || 0}</span>
                    {isLocked && (
                      <span className="text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                        <Lock className="w-3 h-3" /> Locked until {new Date(s.lockedUntil).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Bio, Stack & Model Review */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col gap-6">
          {bio && (
            <div className="border-b border-gray-100 pb-6">
              <span className="text-sm font-semibold text-gray-500 block mb-3 uppercase tracking-wider">Professional Bio</span>
              <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">{bio}</p>
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-8">
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
    </div>
  );
}
