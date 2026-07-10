import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useRequestRevision } from "@/hooks/use-criteria";
import { AlertCircle, RotateCcw } from "lucide-react";

interface RevisionRequestProps {
  isOpen: boolean;
  onClose: () => void;
  criterionId: string;
  criterionText: string;
  onSuccess?: () => void;
}

export default function RevisionRequest({ isOpen, onClose, criterionId, criterionText, onSuccess }: RevisionRequestProps) {
  const revisionMutation = useRequestRevision();
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleRequestRevision = async () => {
    setErrorMsg("");

    if (!note.trim()) {
      setErrorMsg("Revision note is required.");
      return;
    }

    if (note.trim().length < 10) {
      setErrorMsg("Revision note must be at least 10 characters long.");
      return;
    }

    try {
      await revisionMutation.mutateAsync({
        criterionId,
        body: {
          revision_note: note.trim(),
        },
      });
      setNote("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to request revision.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-amber-600">
          <RotateCcw size={20} />
          <span>Request Revision</span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700">
          <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-1">Criterion to Revise</p>
          <p>{criterionText}</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Revision Feedback Note *
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={revisionMutation.isPending}
            placeholder="Provide specific details of what needs to be fixed, missing requirements, or failing checks..."
            className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
          />
          <p className="text-[11px] text-slate-400">Min 10 characters. Clear feedback speeds up delivery.</p>
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
            disabled={revisionMutation.isPending}
            className="text-[12px] h-8 px-3"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRequestRevision}
            disabled={revisionMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-[12px] h-8 px-3 text-white border-none"
          >
            {revisionMutation.isPending ? "Submitting..." : "Send Revision Request"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
