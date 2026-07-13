import React, { useState } from "react";
import { MilestoneDodItemDto, AcceptanceCriterionDto } from "@/types/api.types";
import { useCreateDodItem, useUpdateDodStatus, useCreateBulkDodItems } from "@/hooks/use-dod";
import DodItemRow from "./DodItemRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/input";
import { Plus, ListTodo, ClipboardCheck, AlertCircle, FileText, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface DodChecklistProps {
  milestoneId: string;
  dodItems: MilestoneDodItemDto[];
  acceptanceCriteria: AcceptanceCriterionDto[];
}

export default function DodChecklist({ milestoneId, dodItems = [], acceptanceCriteria = [] }: DodChecklistProps) {
  const createDodMutation = useCreateDodItem();
  const createBulkDodMutation = useCreateBulkDodItems();
  const updateDodMutation = useUpdateDodStatus();

  // State for new DoD item form
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [description, setDescription] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [linkedCriterionId, setLinkedCriterionId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpdateStatus = async (
    itemId: string,
    status: 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE',
    note: string
  ) => {
    return updateDodMutation.mutateAsync({
      milestoneId,
      itemId,
      body: {
        status,
        ...(status === "COMPLETED" && { completion_note: note }),
        ...(status === "NOT_APPLICABLE" && { not_applicable_note: note }),
      }
    });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (isBulkMode) {
      if (!bulkDescription.trim()) {
        setErrorMsg("Please enter at least one task.");
        return;
      }
      
      const tasks = bulkDescription.split('\n').map(t => t.trim()).filter(Boolean);
      if (tasks.length === 0) return;

      try {
        await createBulkDodMutation.mutateAsync({
          milestoneId,
          body: {
            items: tasks.map(t => ({
              item_description: t,
              is_required: isRequired,
              ...(linkedCriterionId && { maps_to_criterion_id: linkedCriterionId }),
            }))
          }
        });
        setBulkDescription("");
        setIsRequired(true);
        setLinkedCriterionId("");
        setIsBulkMode(false);
      } catch (err: any) {
        setErrorMsg(err?.response?.data?.message || "Failed to add bulk checklist items.");
      }
    } else {
      if (!description.trim()) {
        setErrorMsg("Checklist item description cannot be empty.");
        return;
      }

      try {
        await createDodMutation.mutateAsync({
          milestoneId,
          body: {
            item_description: description.trim(),
            is_required: isRequired,
            ...(linkedCriterionId && { maps_to_criterion_id: linkedCriterionId }),
          }
        });
        
        // Reset form
        setDescription("");
        setIsRequired(true);
        setLinkedCriterionId("");
      } catch (err: any) {
        setErrorMsg(err?.response?.data?.message || "Failed to add checklist item.");
      }
    }
  };

  // Group items
  const requiredItems = dodItems.filter(item => item.isRequired);
  const optionalItems = dodItems.filter(item => !item.isRequired);

  // Statistics
  const totalRequired = requiredItems.length;
  const completedRequired = requiredItems.filter(item => item.status === "COMPLETED").length;
  const allRequiredCompleted = totalRequired === completedRequired;

  const totalOptional = optionalItems.length;
  const completedOptional = optionalItems.filter(item => item.status === "COMPLETED" || item.status === "NOT_APPLICABLE").length;

  return (
    <div className="space-y-6">
      {/* Header Stat Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={cn(
          "p-4 rounded-xl border flex items-center gap-3 bg-white",
          allRequiredCompleted ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200"
        )}>
          <div className={cn(
            "p-2.5 rounded-lg",
            allRequiredCompleted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}>
            <ClipboardCheck size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Required DoD Progress</p>
            <p className="text-lg font-bold text-slate-800">
              {completedRequired} / {totalRequired} Completed
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 flex items-center gap-3 bg-white">
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500">
            <ListTodo size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Optional DoD Progress</p>
            <p className="text-lg font-bold text-slate-800">
              {completedOptional} / {totalOptional} Actioned
            </p>
          </div>
        </div>
      </div>

      {/* Main Checklist Sections */}
      <div className="space-y-4">
        {/* Required Items Section */}
        {requiredItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              Required Items <span className="text-red-500 font-bold">*</span>
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {requiredItems.map(item => (
                <DodItemRow
                  key={item.id}
                  item={item}
                  milestoneId={milestoneId}
                  onUpdateStatus={handleUpdateStatus}
                  isUpdating={updateDodMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Optional Items Section */}
        {optionalItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Optional / Supplementary Items
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {optionalItems.map(item => (
                <DodItemRow
                  key={item.id}
                  item={item}
                  milestoneId={milestoneId}
                  onUpdateStatus={handleUpdateStatus}
                  isUpdating={updateDodMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {dodItems.length === 0 && (
          <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <p className="text-sm text-slate-500">No checklist items defined yet for this milestone.</p>
          </div>
        )}
      </div>

      {/* Add Checklist Item Form Card */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Plus size={16} className="text-slate-500" /> Add Custom DoD Item
          </h4>
          <div className="flex items-center p-1 bg-slate-200/50 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setIsBulkMode(false)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
                !isBulkMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List size={14} /> Single Item
            </button>
            <button
              type="button"
              onClick={() => setIsBulkMode(true)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
                isBulkMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FileText size={14} /> Bulk Paste
            </button>
          </div>
        </div>

        <form onSubmit={handleAddItem} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {isBulkMode ? "Paste Checklist Items (One per line) *" : "Item Description *"}
            </label>
            {isBulkMode ? (
              <textarea
                placeholder="Task 1&#10;Task 2&#10;Task 3..."
                value={bulkDescription}
                onChange={(e) => setBulkDescription(e.target.value)}
                disabled={createBulkDodMutation.isPending}
                className="w-full min-h-[120px] p-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
              />
            ) : (
              <Input
                type="text"
                placeholder="e.g., Run lint and formatting scripts, verify API response types"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={createDodMutation.isPending}
                className="w-full"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Optional mapping to Acceptance Criteria */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Maps to Acceptance Criterion (Optional)
              </label>
              <select
                value={linkedCriterionId}
                onChange={(e) => setLinkedCriterionId(e.target.value)}
                disabled={isBulkMode ? createBulkDodMutation.isPending : createDodMutation.isPending}
                className="w-full h-[42px] px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700"
              >
                <option value="">-- No mapping --</option>
                {acceptanceCriteria.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.criterionText.length > 50 ? `${c.criterionText.slice(0, 50)}...` : c.criterionText}
                  </option>
                ))}
              </select>
            </div>

            {/* Required Toggle */}
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="is-required-check"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                disabled={isBulkMode ? createBulkDodMutation.isPending : createDodMutation.isPending}
              />
              <label
                htmlFor="is-required-check"
                className="text-sm font-semibold text-slate-700 cursor-pointer select-none"
              >
                {isBulkMode ? "Are these items required to submit deliverables?" : "Is this item required to submit deliverables?"}
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-error font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isBulkMode ? createBulkDodMutation.isPending : createDodMutation.isPending}
              className="inline-flex items-center gap-2"
            >
              {isBulkMode 
                ? (createBulkDodMutation.isPending ? "Adding Bulk..." : "Add All Items")
                : (createDodMutation.isPending ? "Adding..." : "Add to Checklist")
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
