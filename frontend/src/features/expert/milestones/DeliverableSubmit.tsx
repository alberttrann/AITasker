import React, { useState } from "react";
import { useSubmitMilestone } from "@/hooks/use-submissions";
import { MilestoneDodItemDto } from "@/types/api.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Plus, Trash, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliverableSubmitProps {
  milestoneId: string;
  dodItems: MilestoneDodItemDto[];
  onSuccessSubmit?: () => void;
}

export default function DeliverableSubmit({ milestoneId, dodItems = [], onSuccessSubmit }: DeliverableSubmitProps) {
  const submitMutation = useSubmitMilestone();

  // Form states
  const [description, setDescription] = useState("");
  const [fileUrlInput, setFileUrlInput] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [missingItems, setMissingItems] = useState<Array<{ id: string; itemDescription: string }>>([]);

  // Check required DoD items
  const incompleteRequiredDod = dodItems.filter(
    item => item.isRequired && item.status !== "COMPLETED"
  );
  const hasIncompleteRequired = incompleteRequiredDod.length > 0;

  const handleAddFile = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fileUrlInput.trim()) return;

    // Simple URL validation
    try {
      new URL(fileUrlInput.trim());
    } catch (_) {
      // Allow relative or standard text links too, but warn
    }

    if (fileUrls.includes(fileUrlInput.trim())) {
      setErrorMsg("This file URL is already added.");
      return;
    }

    setFileUrls([...fileUrls, fileUrlInput.trim()]);
    setFileUrlInput("");
    setErrorMsg("");
  };

  const handleRemoveFile = (index: number) => {
    setFileUrls(fileUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setMissingItems([]);

    if (!description.trim()) {
      setErrorMsg("Deliverable description is required.");
      return;
    }

    if (hasIncompleteRequired) {
      setErrorMsg("You cannot submit deliverables while required DoD items are incomplete.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        milestoneId,
        body: {
          description: description.trim(),
          files_json: fileUrls,
        }
      });

      // Clear form
      setDescription("");
      setFileUrls([]);
      setFileUrlInput("");
      
      if (onSuccessSubmit) {
        onSuccessSubmit();
      }
    } catch (err: any) {
      const responseData = err?.response?.data;
      if (responseData?.error === "REQUIRED_DOD_INCOMPLETE") {
        setMissingItems(responseData.missing_items || []);
        setErrorMsg(responseData.message || "Required DoD items are incomplete.");
      } else {
        setErrorMsg(responseData?.message || "Failed to submit deliverable.");
      }
    }
  };

  return (
    <div className="space-y-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Submit Deliverables</h3>
        <p className="text-sm text-slate-500">Provide details of your work and attach delivery links for client review.</p>
      </div>

      {/* DoD gate warning banner */}
      {hasIncompleteRequired && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-bold">Checklist Gate Active</p>
            <p className="text-amber-800">
              You must complete all required Definition of Done (DoD) checklist items before submitting your deliverables.
            </p>
            <div className="pt-1">
              <p className="font-semibold text-xs uppercase tracking-wider text-amber-600 mb-1">Incomplete required items ({incompleteRequiredDod.length}):</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-700">
                {incompleteRequiredDod.map(item => (
                  <li key={item.id}>{item.itemDescription}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Backend returned gate errors (fallback check) */}
      {missingItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-900">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-bold">Required DoD Incomplete</p>
            <p className="text-red-700">The server rejected the submission due to incomplete required items:</p>
            <ul className="list-disc list-inside text-xs text-red-800 font-semibold pt-1">
              {missingItems.map((item, idx) => (
                <li key={item.id || idx}>{item.itemDescription}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Work description */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Work Description *
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitMutation.isPending || hasIncompleteRequired}
            placeholder="Provide a comprehensive summary of what has been accomplished, how to test/verify it, and any deployment links..."
            className="w-full text-sm p-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {/* Files JSON Links list */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Attach Files & Links (e.g. GitHub PRs, Staging sites, Figma files)
          </label>
          
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g. https://github.com/my-project/pull/123"
              value={fileUrlInput}
              onChange={(e) => setFileUrlInput(e.target.value)}
              disabled={submitMutation.isPending || hasIncompleteRequired}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddFile}
              disabled={submitMutation.isPending || hasIncompleteRequired}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus size={16} /> Add Link
            </Button>
          </div>

          {/* List of added files */}
          {fileUrls.length > 0 && (
            <div className="border border-slate-100 rounded-lg p-3 space-y-2 bg-slate-50/50">
              {fileUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between gap-3 text-sm bg-white p-2 rounded-md border border-slate-200/60 shadow-xs">
                  <span className="truncate text-slate-700 font-mono text-xs">{url}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {errorMsg && !missingItems.length && (
          <div className="flex items-center gap-1.5 text-xs text-error font-medium">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {submitMutation.isSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>Deliverables submitted successfully!</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={submitMutation.isPending || hasIncompleteRequired}
            className="w-full sm:w-auto inline-flex items-center gap-2"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Deliverables"}
          </Button>
        </div>
      </form>
    </div>
  );
}
