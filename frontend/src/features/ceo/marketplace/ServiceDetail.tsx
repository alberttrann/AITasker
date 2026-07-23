import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetService, usePurchaseService } from '@/hooks/use-services';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/modal';
import { ArrowLeft, ShieldCheck, MessageSquare, Award, Info } from 'lucide-react';
import { formatVND } from '@/lib/utils';

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: service, isLoading, error, refetch } = useGetService(id);
  const purchaseMutation = usePurchaseService();
  
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [purchaseAction, setPurchaseAction] = useState<'CHAT' | 'PAY' | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !service) {
    const errorMsg = (error as any)?.response?.data?.message || 'Failed to load service details.';
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
        <ErrorBanner message={errorMsg} onRetry={() => refetch()} />
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Go Back
        </Button>
      </div>
    );
  }

  const handlePurchaseIntent = (action: 'CHAT' | 'PAY') => {
    setPurchaseAction(action);
    setIsWarningOpen(true);
  };

  const confirmPurchase = () => {
    if (!id || !purchaseAction) return;

    purchaseMutation.mutate(id, {
      onSuccess: (data: any) => {
        setIsWarningOpen(false);
        const engagementId = data.engagement.id;

        if (purchaseAction === 'CHAT') {
          // Redirect straight to pre-payment workspace chat
          navigate(`/ceo/engagements/${engagementId}/messages`);
        } else {
          // Redirect to checkout QR payment page
          navigate(`/ceo/marketplace/service/${id}/purchase`, {
            state: {
              engagementId,
              vietqrUrl: data.vietqrUrl,
              vaNumber: data.virtualAccount.vaNumber,
              price: service.priceVnd,
              title: service.title,
            },
          });
        }
      },
    });
  };

  return (
    <div className="w-full max-w-[1024px] px-6 mx-auto py-8 space-y-6">
      {/* Header Back Button */}
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(user?.activeRole === 'EXPERT' ? '/expert/marketplace' : '/ceo/marketplace')}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900"
          aria-label="Back to marketplace"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marketplace listing</span>
          <h1 className="text-xl font-bold text-slate-900">Service Specifications</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-3">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-md">
                {service.serviceType === 'AI_SERVICE' ? 'AI Build Service' : 'Technical Discovery'}
              </span>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">{service.title}</h2>
              <p className="text-sm text-slate-500">
                Created by expert: <strong className="text-slate-800">{service.expert?.fullName || 'Anonymous Expert'}</strong>
              </p>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Description</h3>
              <p className="text-slate-600 whitespace-pre-wrap leading-relaxed text-sm">
                {service.description}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-6 flex items-center gap-3 text-slate-500 text-xs bg-slate-50/50 p-4 rounded-xl">
              <Info size={16} className="text-slate-400 shrink-0" />
              <p>
                Standardized services offer fixed scopes. Review the details carefully. If you need modifications, you can chat with the expert to customize the delivery criteria.
              </p>
            </div>
          </Card>
        </div>

        {/* Pricing & CTA Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 space-y-6 border-slate-200 shadow-md">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fixed Price</p>
              <p className="text-3xl font-extrabold text-emerald-600">
                {formatVND(service.priceVnd)}
              </p>
            </div>

            {user?.activeRole === 'CLIENT' && user?.clientSubtype === 'CEO' ? (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <Button
                  variant="primary"
                  onClick={() => handlePurchaseIntent('PAY')}
                  disabled={purchaseMutation.isPending}
                  className="w-full py-3 justify-center font-bold text-sm tracking-wide shadow-sm"
                >
                  {purchaseMutation.isPending && purchaseAction === 'PAY' ? 'Processing...' : 'Buy Now'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handlePurchaseIntent('CHAT')}
                  disabled={purchaseMutation.isPending}
                  className="w-full py-3 justify-center gap-2 border-slate-200 text-slate-700 font-semibold"
                >
                  {purchaseMutation.isPending && purchaseAction === 'CHAT' ? (
                    'Opening chat...'
                  ) : (
                    <>
                      <MessageSquare size={16} />
                      Chat with Expert First
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
                  Only CEO clients can purchase services.
                </div>
              </div>
            )}

            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex gap-3 text-xs text-slate-600">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>
                  <strong>Escrow Protected:</strong> Funds are locked securely and only released when you approve the work.
                </span>
              </div>
              <div className="flex gap-3 text-xs text-slate-600">
                <Award className="w-5 h-5 text-blue-500 shrink-0" />
                <span>
                  <strong>Expert Verified:</strong> Platform experts are vetting-backed and verified.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Safety Escrow & Delivery Notice */}
      <ConfirmModal
        isOpen={isWarningOpen}
        onClose={() => setIsWarningOpen(false)}
        onConfirm={confirmPurchase}
        title={purchaseAction === 'CHAT' ? 'Start Conversation with Expert' : 'Safety Escrow & Delivery Notice'}
        confirmText={purchaseAction === 'CHAT' ? 'Start Chat' : 'Continue to Payment'}
        cancelText="Cancel"
      >
        {purchaseAction === 'CHAT' ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              You are opening a direct message workspace with the expert to discuss <strong>{service.title}</strong>.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs leading-relaxed space-y-1">
              <strong className="font-bold flex items-center gap-1">
                <Info size={14} /> Pre-Purchase Chat
              </strong>
              <p>
                No payment or escrow deposit is required to start chatting. You can align on custom specifications or ask questions before committing to the purchase.
              </p>
            </div>
            <p>Click confirm to open the direct conversation thread.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              You are placing an order for <strong>{service.title}</strong> for <strong className="text-emerald-600">{formatVND(service.priceVnd)}</strong>.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed space-y-1">
              <strong className="font-bold flex items-center gap-1">
                <Info size={14} /> Safety Suggestion
              </strong>
              <p>
                Your payment will be locked safely in escrow and only released after you verify the final deliverables. 
                We highly recommend chatting with the expert first to align on details.
              </p>
            </div>
            <p>Click confirm to proceed and open the direct workspace checkout.</p>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
