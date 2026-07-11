import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { MatchResult, GapMapItem } from '@t/jsonb.types';
import { useSocket } from '@/hooks/use-socket';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, Send } from 'lucide-react';

interface MatchCardProps {
  expert: MatchResult;
  projectId: string;
  projectName?: string;
}

const STRENGTH_STYLES: Record<string, string> = {
  STRONG_MATCH: 'bg-[#22C55E15] text-[#16A34A]',
  GOOD_MATCH: 'bg-[#0EA5E915] text-[#0284C7]',
  POSSIBLE_MATCH: 'bg-[#EAB30815] text-[#CA8A04]',
  WEAK_MATCH: 'bg-red-50 text-red-600',
};

export default function MatchCard({ expert, projectId, projectName }: MatchCardProps) {
  // Fetch public profile since matching backend strips it
  const { data: profile, isLoading } = useQuery({
    queryKey: ['expertProfile', expert.expert_id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${expert.expert_id}/public-profile`);
      return data;
    },
  });

  const socket = useSocket();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [invited, setInvited] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      handleInvite();
    }
    return () => clearTimeout(timer);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = isLoading ? 'Loading Expert...' : profile?.fullName || 'Expert';
  const strength = expert.strength_label || 'POSSIBLE_MATCH';
  const strengthStyle = STRENGTH_STYLES[strength] ?? STRENGTH_STYLES.POSSIBLE_MATCH;
  const strengthDisplay = strength.replace('_MATCH', '').replace('_', ' ');
  const stackTags = (profile?.stackTags ?? []) as string[];
  const gaps: GapMapItem[] = expert.gap_map ?? [];

  useEffect(() => {
    if (name !== 'Loading Expert...' && !inviteMessage) {
      setInviteMessage(`Hi ${name},\n\nI'd like to invite you to submit a bid for ${projectName || 'this project'}. Your expertise looks like a great fit for what we're building, and I'd love to see your proposal.`);
    }
  }, [name, projectName, inviteMessage]);

  return (
    <>
      <div 
        className="rounded-lg border border-slate-200 bg-surface p-5 transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        {/* Header: name + strength label */}
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-body font-headline font-semibold text-primary">
            {name}
          </h3>
          <span className={`inline-flex items-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${strengthStyle}`}>
            {strengthDisplay}
          </span>
        </div>

        {/* Seam Coverage */}
        {gaps.length > 0 && (
          <div className="mb-3">
            <span className="text-caption text-secondary">Seam Coverage</span>
            <div className="mt-1 flex gap-1">
              {gaps.map((g) => (
                <span
                  key={g.seam_code}
                  className={`h-3 w-3 rounded-full ${
                    g.color === 'green'
                      ? 'bg-success'
                      : g.color === 'amber'
                        ? 'bg-warning'
                        : 'bg-error'
                  }`}
                  title={g.seam_code}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stack Tags */}
        {stackTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stackTags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-primary-bg px-2 py-0.5 text-caption text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setInviteError(null); setCountdown(null); }} 
        title="Invite Expert"
        className="sm:w-[780px] sm:max-w-[780px]"
      >
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Side: Profile Information */}
          <div className="flex-1 space-y-7">
            {/* Avatar, Name & Strength */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 ring-4 ring-emerald-50 shadow-sm">
                <span className="text-2xl font-bold">{name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="pt-1">
                <h3 className="text-[18px] font-headline font-bold text-slate-900">
                  {name}
                </h3>
                <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${strengthStyle}`}>
                  {strengthDisplay}
                </span>
              </div>
            </div>

            {/* Bio Section */}
            {profile?.bio && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Professional Bio</h4>
                <p className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Domains Section */}
            {profile?.domainDepths && profile.domainDepths.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Domain Expertise</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.domainDepths.map((domain: any) => (
                    <div key={domain.domainCode} className="inline-flex items-center rounded-[6px] bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600">
                      <span className="font-semibold text-slate-800 mr-1.5">{domain.domainCode}</span>
                      <span className="opacity-60 text-[11px] uppercase tracking-wider">{domain.depthLevel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seam Coverage Section */}
            {gaps.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Project Seam Coverage</h4>
                <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-[8px] p-3">
                  {gaps.map((g) => {
                    const isVerified = profile?.seamClaims?.some(
                      (sc: any) => sc.seamCode === g.seam_code && (sc.verificationTier === 'EVIDENCE_BACKED' || sc.verificationTier === 'VERIFIED')
                    );
                    
                    return (
                      <div key={g.seam_code} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shadow-sm shrink-0 ${
                              g.color === 'green' ? 'bg-emerald-500' : g.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-[13px] font-medium text-slate-700">
                            {g.seam_code} 
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            {g.color === 'green' && 'Full'}
                            {g.color === 'amber' && 'Partial'}
                            {g.color === 'red' && 'Gap'}
                          </span>
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wide" title="AI Verified">
                              <CheckCircle className="h-2.5 w-2.5" /> Verified
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stack Tags Section */}
            {stackTags.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Technical Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                  {stackTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600 border border-slate-200/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Message & Action */}
          <div className="w-full md:w-[320px] flex flex-col shrink-0">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-[12px] p-5 flex-1 flex flex-col shadow-sm">
              <h4 className="text-[14px] font-headline font-semibold text-slate-900 mb-1">Invitation Message</h4>
              <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
                 Send a personalized note alongside your invite to encourage a response.
              </p>
              
              <textarea
                className="w-full flex-1 min-h-[220px] rounded-[8px] border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none shadow-sm transition-shadow"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                disabled={isInviting || invited}
                placeholder="Write your message here..."
              />

              {/* ── Invite Button ── */}
              <div className="mt-5">
                {inviteError && (
                  <p className="mb-3 text-[12px] text-rose-500 font-medium" role="alert">
                    {inviteError}
                  </p>
                )}
                {invited ? (
                  <Button variant="outline" className="w-full cursor-default bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" disabled>
                    <CheckCircle size={16} className="mr-2" />
                    Invitation Sent
                  </Button>
                ) : (
                  <Button
                    variant={countdown !== null ? 'destructive' : 'primary'}
                    className="w-full h-11 text-[14px] shadow-sm font-medium"
                    disabled={isInviting}
                    onClick={() => {
                      if (countdown !== null) {
                        setCountdown(null);
                      } else {
                        setCountdown(5);
                      }
                    }}
                    aria-label={countdown !== null ? 'Cancel Invite' : `Invite ${name} to bid`}
                  >
                    {isInviting ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" /> Sending...
                      </span>
                    ) : countdown !== null ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" /> Cancel ({countdown}s)
                      </span>
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );

  // ── Socket.io invite handler ───────────────────────────────────

  async function handleInvite() {
    if (!socket) {
      setInviteError('Connection lost. Please refresh the page.');
      return;
    }
    setIsInviting(true);
    setInviteError(null);

    try {
      // Join the project pre-bid chat room
      socket.emit('joinRoom', { projectId });
      // Send invitation via the dedicated inviteExpert event
      socket.emit('inviteExpert', {
        expertId: expert.expert_id,
        projectId: projectId,
        content: inviteMessage,
      });
      setInvited(true);
    } catch {
      setInviteError('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  }
}
