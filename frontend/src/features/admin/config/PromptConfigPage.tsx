// frontend/src/features/admin/config/PromptConfigPage.tsx 
import { useState, useEffect } from 'react';
import { useAdminPrompts, useAdminPrompt, useUpsertAdminPrompt, useResetAdminPrompt } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { ArrowLeft, FileCode2, Save, Trash2, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PromptConfigPage() {
  const { data: promptList, isLoading: listLoading } = useAdminPrompts();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const { data: promptDetail, isLoading: detailLoading, isError: detailError } = useAdminPrompt(selectedStage);
  const upsertPrompt = useUpsertAdminPrompt();
  const resetPrompt = useResetAdminPrompt();

  const [templateText, setTemplateText] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync state when detail loads or falls back
  useEffect(() => {
    if (promptDetail) {
      setTemplateText(promptDetail.templateText || "");
      setDescription(promptDetail.description || "");
    } else if (detailError && selectedStage) {
      // 404 means it's falling back to the .txt file on disk
      setTemplateText("/* No DB override found. Currently using default .txt file from server */\n\n");
      setDescription("");
    }
  }, [promptDetail, detailError, selectedStage]);

  const handleSave = () => {
    if (!selectedStage) return;
    upsertPrompt.mutate(
      { stage: selectedStage, templateText, description },
      {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        }
      }
    );
  };

  const handleReset = () => {
    if (!selectedStage) return;
    resetPrompt.mutate(selectedStage, {
      onSuccess: () => {
        setIsResetConfirmOpen(false);
      }
    });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">AI Prompt Templates</h1>
          <p className="text-slate-500">Live-edit system prompts. Fallbacks to server .txt if deleted.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Stage List */}
        <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)] sticky top-6">
          <div className="bg-slate-50 border-b border-slate-100 p-4 font-bold text-slate-700 uppercase tracking-wider text-xs">
            Configured Stages
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {listLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
              promptList?.map((p: any) => (
                <button
                  key={p.stage}
                  onClick={() => setSelectedStage(p.stage)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedStage === p.stage ? 'bg-indigo-50/50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="font-semibold text-slate-900 mb-1">{p.stage}</div>
                  <div className="text-xs text-slate-500">Version: {p.version || 1} • {new Date(p.updatedAt).toLocaleDateString()}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="w-full lg:w-2/3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
          {!selectedStage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <FileCode2 size={48} className="mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-700">Select a Prompt Stage</h3>
              <p className="text-sm">Choose a stage from the left to edit its Jinja2 template.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{selectedStage}</h3>
                  <p className="text-xs text-slate-500">Cache TTL: 60s</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsResetConfirmOpen(true)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 gap-1.5">
                    <Trash2 size={14} /> Revert to Default
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={upsertPrompt.isPending} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                    {upsertPrompt.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                    {upsertPrompt.isPending ? 'Saving...' : 'Save Override'}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 border-b border-slate-100">
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Internal notes about this prompt version..."
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {showSuccess && (
                <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-2 border-b border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Saved successfully. Changes propagate within 60s.
                </div>
              )}

              <div className="flex-1 p-4 bg-[#1e1e1e] overflow-hidden flex flex-col">
                <textarea
                  value={templateText}
                  onChange={e => setTemplateText(e.target.value)}
                  className="w-full h-full bg-transparent text-slate-300 font-mono text-[13px] leading-relaxed resize-none outline-none custom-scrollbar"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleReset}
        title="Revert to Default"
        confirmText="Revert"
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to delete the DB override for <strong>{selectedStage}</strong>? The AI service will fall back to reading the underlying `.txt` file from the codebase.
      </ConfirmModal>
    </div>
  );
}