import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicProfile } from '@/hooks/use-user';
import { useUserReviews } from '@/hooks/use-reviews';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, Star, CheckCircle, Send, CheckCircle2 } from 'lucide-react';
import { formatVND, formatSeamCode } from '@/lib/utils';
import { useDomains, useSeams } from '@/hooks/use-config';
import { useProjects } from '@/hooks/use-projects';
import { useSocket } from '@/hooks/use-socket';
import { Modal } from '@/components/ui/modal';

export default function CeoExpertProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: profileData, isLoading, error } = usePublicProfile(userId);
  const { data: reviews } = useUserReviews(userId);
  const { data: domainsList } = useDomains();
  const { data: seamsList } = useSeams();
  const socket = useSocket();
  const { projects, isLoadingProjects } = useProjects(true); // Slim projects fetch
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const publishedProjects = projects?.filter((p: any) => p.state === 'PUBLISHED') || [];

  const handleInvite = () => {
    if (!socket || !selectedProjectId) return;
    setIsInviting(true);
    
    // Join room & emit invite event (Matches the logic from MatchCard.tsx)
    socket.emit('joinRoom', { projectId: selectedProjectId });
    socket.emit('inviteExpert', {
      expertId: userId,
      projectId: selectedProjectId,
      content: inviteMessage || `Hi ${profileData?.fullName || 'there'},\n\nI'd like to invite you to submit a bid for my project. Your expertise looks like a great fit!`,
    });

    // Simulate short network delay for UX
    setTimeout(() => {
      setIsInviting(false);
      setInviteSuccess(true);
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(false);
        setInviteMessage('');
        setSelectedProjectId('');
      }, 2000);
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-6 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Expert Profile Not Found</h2>
        <p className="text-slate-500 text-sm">The requested expert profile could not be loaded.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft size={16} /> Go Back
        </Button>
      </div>
    );
  }

  const {
    fullName,
    bio,
    engagementMode,
    stackTags,
    domainDepths,
    seamClaims,
    avgRating,
    reviewCount,
    activeListings,
  } = profileData;

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Back Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Expert Directory
            </span>
            <h1 className="text-xl font-bold text-slate-900">Public Profile</h1>
          </div>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} className="gap-2">
          <Send size={16} /> Invite to Project
        </Button>
      </div>

      {/* Profile Card Header */}
      <Card className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-2xl flex items-center justify-center shrink-0">
              {fullName?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{fullName}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  {avgRating ? Number(avgRating).toFixed(1) : 'New'} ({reviewCount || 0} reviews)
                </span>
                <span>•</span>
                <span className="font-medium">
                  {engagementMode?.replace('_', ' ') || 'Milestone-based'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              About the Expert
            </h3>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
          </div>
        )}

        {/* Tech Stack Tags */}
        {stackTags && stackTags.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Tech Stack
            </h3>
            <div className="flex flex-wrap gap-2">
              {stackTags.map((tag: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Domain Depths */}
        {domainDepths && domainDepths.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Domain Expertise
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {domainDepths.map((d: any) => {
                const name =
                  domainsList?.find((def) => def.code === d.domainCode)?.name || d.domainCode;
                return (
                  <div
                    key={d.domainCode}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center text-sm"
                  >
                    <span className="font-semibold text-slate-800">{name}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-xs rounded border border-blue-100">
                      {d.depthLevel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Seam Claims */}
        {seamClaims && seamClaims.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Verified Integrations (Seams)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {seamClaims.map((s: any) => {
                const name =
                  seamsList?.find((def) => def.code === s.seamCode)?.name || s.seamCode;
                const isVerified =
                  s.verificationTier === 'EVIDENCE_BACKED' || s.verificationTier === 'VERIFIED';
                return (
                  <div
                    key={s.seamCode}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center text-sm"
                  >
                    <span className="font-semibold text-slate-800">{formatSeamCode(name)}</span>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded border border-emerald-200">
                        <CheckCircle size={12} /> Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded border border-slate-200">
                        Claimed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Active Services */}
      {activeListings && activeListings.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Services Offered</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeListings.map((svc: any) => (
              <Card key={svc.id} className="p-5 flex flex-col justify-between hover:border-blue-300 transition-colors">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {svc.serviceType === 'AI_SERVICE' ? 'AI Build' : 'Discovery'}
                  </span>
                  <h4 className="font-bold text-slate-900 text-base mt-2 mb-1">{svc.title}</h4>
                </div>
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                  <span className="font-bold text-emerald-600 text-sm">
                    {formatVND(Number(svc.priceVnd))}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/ceo/marketplace/service/${svc.id}`)}
                  >
                    View Service
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Customer Reviews */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Client Reviews</h3>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r: any) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">
                    {r.reviewer?.fullName || 'Client'}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {r.rating} / 5
                  </div>
                </div>
                {r.comment && (
                  <p className="text-xs text-slate-600 leading-relaxed italic">"{r.comment}"</p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-slate-400 text-sm">
            No reviews received yet for this expert.
          </Card>
        )}
      </div>

      {/* Invite to Project Modal */}
      <Modal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        title="Invite Expert to Project"
        className="sm:max-w-[500px]"
      >
        {inviteSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <CheckCircle2 size={48} className="text-emerald-500 mb-4 animate-in zoom-in" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Invitation Sent!</h3>
            <p className="text-slate-500 text-sm">The expert will be notified and can submit a bid to your project.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Project</label>
              {publishedProjects.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200">
                  You don't have any published projects. Please complete an elicitation session and publish a project first.
                </div>
              ) : (
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>-- Select a published project --</option>
                  {publishedProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.projectName || `Project ${p.id.slice(0,8)}`}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message (Optional)</label>
              <textarea 
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder={`Hi ${fullName?.split(' ')[0] || 'there'},\n\nI'd like to invite you to submit a bid for my project...`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleInvite} 
                disabled={!selectedProjectId || isInviting || !socket}
                className="gap-2"
              >
                {isInviting ? <Spinner size="sm" className="text-white" /> : <Send size={16} />}
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}