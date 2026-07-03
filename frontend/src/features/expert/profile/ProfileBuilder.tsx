import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import DomainDepthGrid from './DomainDepthGrid';
import SeamClaimsGrid from './SeamClaimsGrid';
import type { DomainDepth, SeamClaim } from '@/types/ui.types';
import StackTagsPicker from './StackTagsPicker';
import { CheckCircle, ShieldCheck, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

export default function ProfileBuilder({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'domains' | 'seams' | 'tags' | 'review'>('domains');
  
  const { profile, isLoadingProfile } = useExpertProfile();

  const [selectedDomains, setSelectedDomains] = useState<DomainDepth[]>(() => profile?.domainDepths || []);
  const [selectedSeams, setSelectedSeams] = useState<SeamClaim[]>(() => profile?.seamClaims || []);
  const [stackTags, setStackTags] = useState<string[]>(() => profile?.profile?.stackTagsJson || []);
  const [engagementModel, setEngagementModel] = useState<string>(() => profile?.profile?.engagementModel || 'MILESTONE');
  const [bio, setBio] = useState<string>(() => profile?.profile?.bio || '');

  useEffect(() => {
    if (profile) {
      if (profile.domainDepths?.length) setSelectedDomains(profile.domainDepths);
      if (profile.seamClaims?.length) setSelectedSeams(profile.seamClaims);
      if (profile.profile?.stackTagsJson?.length) setStackTags(profile.profile.stackTagsJson);
      if (profile.profile?.engagementModel) setEngagementModel(profile.profile.engagementModel);
      if (profile.profile?.bio) setBio(profile.profile.bio);
    }
  }, [profile]);

  const handlePublish = async () => {
    // In a real app we might do a final PUT /expert-profile/publish here
    if (onCancel) {
      onCancel();
    } else {
      navigate('/expert');
    }
  };

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

  if (isLoadingProfile) {
    return (
      <div className="w-full max-w-5xl mx-auto py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <Spinner size="lg" className="mb-4" />
        <p className="text-gray-500 font-medium">Loading profile builder...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'domains', label: '1. Domains', done: selectedDomains.length > 0 },
    { key: 'seams',   label: '2. Seams',   done: selectedSeams.length > 0 },
    { key: 'tags',    label: '3. Stack, Model & Bio', done: stackTags.length > 0 },
    { key: 'review',  label: '4. Review',  done: false },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Expert Profile Builder</h1>
          <p className="text-gray-500 mt-2 text-lg">Define your capabilities to match with high-value AI projects.</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b overflow-x-auto hide-scrollbar bg-gray-50/50">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center whitespace-nowrap px-6 py-4 border-b-2 font-bold text-sm transition-colors ${
                activeTab === tab.key 
                  ? 'border-blue-600 text-blue-700 bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              {tab.label}
              {tab.done && <CheckCircle className="w-4 h-4 ml-2 text-emerald-500" />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 md:p-8">
          {activeTab === 'domains' && (
            <DomainDepthGrid 
              initialDomains={selectedDomains}
              lockedDomainsRecord={
                selectedSeams
                  .filter((s: any) => s.verificationTier === 'VERIFIED' || s.verificationTier === 'EVIDENCE_BACKED' || (s.submissionCount || 0) > 0)
                  .reduce((acc: Record<string, string>, s: any) => {
                    const domains = (s.seamCode || s.code || '').split('↔');
                    domains.forEach((d: string) => {
                      if (!acc[d]) acc[d] = s.seamCode || s.code;
                    });
                    return acc;
                  }, {})
              }
              onSave={(domains) => {
                setSelectedDomains(domains);
                setActiveTab('seams');
              }} 
            />
          )}

          {activeTab === 'seams' && (
            <SeamClaimsGrid 
              initialSeams={selectedSeams}
              selectedDomainCodes={selectedDomains.map(d => d.domainCode)}
              onSave={(seams) => {
                setSelectedSeams(seams);
                setActiveTab('tags');
              }} 
            />
          )}

          {activeTab === 'tags' && (
            <StackTagsPicker 
              initialTags={stackTags}
              initialModel={engagementModel}
              initialBio={bio}
              onSave={(tags, model, newBio) => {
                setStackTags(tags);
                setEngagementModel(model);
                setBio(newBio);
                setActiveTab('review');
              }} 
            />
          )}

          {activeTab === 'review' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Review Your Profile</h3>
                  <p className="text-gray-500 text-sm">Please verify your details before publishing.</p>
                </div>
              </div>
              
              {/* Domains Review */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-lg text-gray-900">Domain Expertise</h4>
                  <button onClick={() => setActiveTab('domains')} className="text-blue-600 text-sm font-semibold hover:underline">Edit</button>
                </div>
                {selectedDomains.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No domains selected.</p>
                ) : (
                  <div className="grid gap-3">
                    {selectedDomains.map(d => (
                      <div key={d.domainCode} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <span className="font-medium text-gray-700">{d.domainCode} · {getDomainLabel(d.domainCode)}</span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full">{d.depthLevel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Seams Review */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-lg text-gray-900">Seam Claims</h4>
                  <button onClick={() => setActiveTab('seams')} className="text-blue-600 text-sm font-semibold hover:underline">Edit</button>
                </div>
                {selectedSeams.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No seams selected.</p>
                ) : (
                  <div className="grid gap-3">
                    {selectedSeams.map((s: any) => (
                      <div key={s.seamCode || s.code} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 font-bold text-xs rounded border">{s.seamCode || s.code}</span>
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          {getSeamLabel(s.seamCode || s.code)}
                          {(s.verificationTier === 'EVIDENCE_BACKED' || s.verificationTier === 'VERIFIED') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                              <CheckCircle className="h-3 w-3" /> AI Verified
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stack & Model Review */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-lg text-gray-900">Bio, Tech Stack & Engagement</h4>
                  <button onClick={() => setActiveTab('tags')} className="text-blue-600 text-sm font-semibold hover:underline">Edit</button>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm font-semibold text-gray-500 block mb-2 uppercase tracking-wider">Professional Bio</span>
                  {bio ? (
                    <p className="text-gray-900 text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">{bio}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No bio provided.</p>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-sm font-semibold text-gray-500 block mb-2 uppercase tracking-wider">Tech Stack</span>
                  {stackTags.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No stack tags specified.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {stackTags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-500 block mb-1 uppercase tracking-wider">Engagement Model</span>
                  <p className="font-bold text-gray-900">{engagementModel.replace('_', ' ')}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <button 
                  onClick={handlePublish} 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-extrabold text-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-6 h-6" />
                  Publish Expert Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
