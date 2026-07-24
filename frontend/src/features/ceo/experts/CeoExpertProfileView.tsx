import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicProfile } from '@/hooks/use-user';
import { useUserReviews } from '@/hooks/use-reviews';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, Star, CheckCircle } from 'lucide-react';
import { formatVND, formatSeamCode } from '@/lib/utils';
import { useDomains, useSeams } from '@/hooks/use-config';

export default function CeoExpertProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: profileData, isLoading, error } = usePublicProfile(userId);
  const { data: reviews } = useUserReviews(userId);
  const { data: domainsList } = useDomains();
  const { data: seamsList } = useSeams();

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
    </div>
  );
}