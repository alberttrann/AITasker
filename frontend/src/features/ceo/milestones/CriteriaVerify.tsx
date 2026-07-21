import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useVerifyCriterion } from "@/hooks/use-criteria";
import { AlertCircle, CheckCircle } from "lucide-react";

interface CriteriaVerifyProps {
  isOpen: boolean;
  onClose: () => void;
  criterionId: string;
  criterionText: string;
  onSuccess?: () => void;
}

export default function CriteriaVerify({ isOpen, onClose, criterionId, criterionText, onSuccess }: CriteriaVerifyProps) {
  const verifyMutation = useVerifyCriterion();
  const [comment, setComment] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = async () => {
    setErrorMsg("");
    try {
      await verifyMutation.mutateAsync({
        criterionId,
        body: {
          verification_comment: comment.trim() || undefined,
        },
      });
      setComment("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to verify criterion.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle size={20} />
          <span>Verify Criterion</span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700">
          <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-1">Criterion Text</p>
          <p>{criterionText}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="textarea-criterion-verification-comment" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Verification Comment (Optional)
          </label>
          <textarea
            id="textarea-criterion-verification-comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={verifyMutation.isPending}
            placeholder="Add comments on why this criterion is satisfied (e.g. verified test execution, staging logs look good)..."
            className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none disabled:cursor-not-allowed"
          />
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-error font-medium">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={verifyMutation.isPending}
            className="text-[12px] h-8 px-3 cursor-pointer disabled:cursor-not-allowed"
            id="btn-cancel-criterion-verification"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleVerify}
            disabled={verifyMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-[12px] h-8 px-3 cursor-pointer disabled:cursor-not-allowed"
            id="btn-confirm-criterion-verification"
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify & Sign Off"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
