import React, { useState } from "react";
import { MilestoneDodItemDto } from "@/types/api.types";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/button";
import { Check, Edit, Trash, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DodItemRowProps {
  item: MilestoneDodItemDto;
  milestoneId: string;
  onUpdateStatus: (itemId: string, status: 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE', note: string) => Promise<any>;
  isUpdating: boolean;
}

export default function DodItemRow({ item, milestoneId, onUpdateStatus, isUpdating }: DodItemRowProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE' | null>(null);
  const [validationError, setValidationError] = useState("");

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setValidationError("");
    
    // INSTANT UNCHECK: If they uncheck, immediately revert to PENDING and hide inputs
    if (!checked) {
      setShowNoteInput(false);
      setPendingStatus(null);
      setNote("");
      onUpdateStatus(item.id, "PENDING", "");
      return;
    }

    if (item.isRequired) {
      setPendingStatus("COMPLETED");
      setNote(item.completionNote || "");
      setShowNoteInput(true);
    } else {
      // Optional item: default to COMPLETED without note if they just check it
      setPendingStatus("COMPLETED");
      setNote(item.completionNote || "");
      setShowNoteInput(true);
    }
  };

  const handleMarkNa = () => {
    setValidationError("");
    if (item.isRequired) return; // DB constraint blocks this anyway
    setPendingStatus("NOT_APPLICABLE");
    setNote(item.notApplicableNote || "");
    setShowNoteInput(true);
  };

  const handleCancel = () => {
    setShowNoteInput(false);
    setPendingStatus(null);
    setNote("");
    setValidationError("");
  };

  const handleSave = async () => {
    if (!pendingStatus) return;

    if (pendingStatus === "COMPLETED" && item.isRequired && !note.trim()) {
      setValidationError("Completion note is required for all required items.");
      return;
    }

    if (pendingStatus === "NOT_APPLICABLE" && !note.trim()) {
      setValidationError("Please explain why this item is not applicable.");
      return;
    }

    try {
      await onUpdateStatus(item.id, pendingStatus, note);
      setShowNoteInput(false);
      setPendingStatus(null);
      setNote("");
      setValidationError("");
    } catch (err: any) {
      setValidationError(err?.response?.data?.message || "Failed to update DoD item status.");
    }
  };

  const isCompleted = item.status === "COMPLETED";
  const isNa = item.status === "NOT_APPLICABLE";

  return (
    <div className={cn(
      "border border-slate-100 rounded-xl p-4 transition-all duration-200 bg-white",
      isCompleted && "bg-emerald-50/20 border-emerald-100/70",
      isNa && "bg-slate-50/70 border-slate-200/60 opacity-80"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Checkbox
            checked={isCompleted || pendingStatus === "COMPLETED"}
            onChange={handleCheckboxChange}
            disabled={isUpdating}
            className="mt-1"
          />
          <div className="min-w-0">
            <p className={cn(
              "text-[15px] font-medium text-slate-800 leading-snug break-words",
              isCompleted && "text-slate-900",
              isNa && "line-through text-slate-400"
            )}>
              {item.itemDescription}
              {item.isRequired && (
                <span className="text-red-500 ml-1 font-bold" title="Required DoD item">*</span>
              )}
            </p>

            {/* Subnotes or notes display */}
            {isCompleted && item.completionNote && (
              <p className="text-xs text-emerald-700 bg-emerald-100/40 border border-emerald-100/50 rounded-lg px-2.5 py-1.5 mt-2 italic break-words">
                <strong>Completion note:</strong> {item.completionNote}
              </p>
            )}

            {isNa && item.notApplicableNote && (
              <p className="text-xs text-slate-500 bg-slate-100/60 border border-slate-200/50 rounded-lg px-2.5 py-1.5 mt-2 italic break-words">
                <strong>N/A Reason:</strong> {item.notApplicableNote}
              </p>
            )}
          </div>
        </div>

        {/* Action column */}
        <div className="flex items-center gap-2 shrink-0">
          {!item.isRequired && !isCompleted && !isNa && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkNa}
              disabled={isUpdating}
              className="text-[12px] h-8 px-3 text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50"
            >
              Mark N/A
            </Button>
          )}

          {isNa && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateStatus(item.id, "PENDING", "")}
              disabled={isUpdating}
              className="text-[12px] h-8 px-2.5 text-slate-500 hover:text-slate-900"
            >
              Revert
            </Button>
          )}

          {/* Quick Edit Note button */}
          {(isCompleted || isNa) && !showNoteInput && (
            <button
              onClick={() => {
                setPendingStatus(item.status);
                setNote(isCompleted ? (item.completionNote || "") : (item.notApplicableNote || ""));
                setShowNoteInput(true);
              }}
              disabled={isUpdating}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
              title="Edit Note"
            >
              <Edit size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Note input box (expanded inline) */}
      {showNoteInput && (
        <div className="mt-4 border-t border-dashed border-slate-200 pt-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            {pendingStatus === "COMPLETED" ? "Add Completion Note *" : "Reason for Mark N/A *"}
          </label>
          
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              pendingStatus === "COMPLETED"
                ? "Describe what has been completed or reference pull requests, tests, etc..."
                : "Describe why this requirement does not apply to this milestone's deliverable..."
            }
            className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          />

          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-error font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isUpdating}
              className="text-[12px] h-8 px-3"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isUpdating}
              className="text-[12px] h-8 px-3"
            >
              {isUpdating ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
