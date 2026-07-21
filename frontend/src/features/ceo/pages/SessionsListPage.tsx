import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  useSessionHistory, 
  useRestoreElicitationSession, 
  useHardDeleteElicitationSession,
  useActiveElicitationSession,
  useDeleteElicitationSession,
  useElicitationSessions
} from "@/hooks/use-projects";
import { ConfirmModal } from "@/components/ui/modal";
import { ArrowLeft, ArrowUpDown, Trash2, Clock, ArrowRight, Loader2 } from "lucide-react";

export default function SessionsListPage() {
  const navigate = useNavigate();
  const restoreSession = useRestoreElicitationSession();
  const hardDeleteSession = useHardDeleteElicitationSession();
  const { activeSession } = useActiveElicitationSession();
  const abandonSession = useDeleteElicitationSession();

  const [sessionToHardDelete, setSessionToHardDelete] = useState<string | null>(null);
  const [showEmptyBinConfirm, setShowEmptyBinConfirm] = useState(false);
  const [sessionSort, setSessionSort] = useState<'date_desc' | 'date_asc' | 'status'>('date_desc');
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useSessionHistory();

  const abandonedSessions = sessions.filter((s: any) => s.state === 'ABANDONED');
  const returnedSessions = sessions.filter((s: any) => s.state === 'RETURNED');

  const allHistorySessions = useMemo(() => {
    const combined = [
      ...returnedSessions.map((s: any) => ({ ...s, historyStatus: 'returned' })),
      ...abandonedSessions.map((s: any) => ({ ...s, historyStatus: 'abandoned' }))
    ];

    return combined.sort((a, b) => {
      const getSafeDate = (obj: any) => new Date(obj.updatedAt || obj.updated_at || obj.createdAt || obj.created_at || 0).getTime();
      
      if (sessionSort === 'date_desc') return getSafeDate(b) - getSafeDate(a);
      if (sessionSort === 'date_asc') return getSafeDate(a) - getSafeDate(b);
      
      if (sessionSort === 'status') return a.historyStatus.localeCompare(b.historyStatus);
      return 0;
    });
  }, [returnedSessions, abandonedSessions, sessionSort]);

  const formatDraftName = (dateString: string) => {
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `Session ${d}${m}${y}${hh}${mm}${ss}`;
  };

  const handleContinueSession = async (session: any) => {
    try {
      setRestoringId(session.id);
      if (activeSession?.id && activeSession.id !== session.id) {
        await abandonSession.mutateAsync(activeSession.id);
      }
      
      if (session.state === 'RETURNED') {
        navigate("/ceo/projects/elicitation", { state: { resumeSessionId: session.id } });
      } else {
        await restoreSession.mutateAsync(session.id);
        navigate("/ceo/projects/elicitation");
      }
    } catch (error) {
      console.error("Failed to restore session", error);
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1440px] mx-auto flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ceo/projects')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Session History</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and recover your abandoned draft sessions.</p>
          </div>
        </div>

        {abandonedSessions.length > 0 && (
          <button
            onClick={() => setShowEmptyBinConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 font-medium rounded-lg transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Empty List
          </button>
        )}
      </div>

      {/* List content */}
      {abandonedSessions.length === 0 && returnedSessions.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-slate-900 mb-1">No session history</h4>
          <p className="text-slate-500 mb-6">You don't have any abandoned drafts or returned sessions in your history.</p>
          <button
            onClick={() => navigate('/ceo/projects')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
            Back to Projects
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {allHistorySessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">
                  Session History
                </h4>
                <div className="relative">
                  <button 
                    onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowUpDown size={16} />
                    Order by
                  </button>
                  {isSessionDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-10">
                      <button onClick={() => { setSessionSort('date_desc'); setIsSessionDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${sessionSort === 'date_desc' ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>Newest First</button>
                      <button onClick={() => { setSessionSort('date_asc'); setIsSessionDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${sessionSort === 'date_asc' ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>Oldest First</button>
                      <button onClick={() => { setSessionSort('status'); setIsSessionDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${sessionSort === 'status' ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>Status</button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                {allHistorySessions.map((session: any) => {
                  const safeCreated = session.createdAt || session.created_at || new Date();
                  const safeUpdated = session.updatedAt || session.updated_at || new Date();
                  const safeStage = session.currentStage || session.current_stage || 1;
                  const isReturned = session.historyStatus === 'returned';

                  return isReturned ? (
                    <div
                      key={session.id}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[11px] font-bold uppercase rounded border border-amber-300">
                             Returned
                           </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-1 truncate">
                          {formatDraftName(safeCreated || safeUpdated)}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="text-amber-700 font-medium">Quality Gate Failed</span>
                          <span>&middot;</span>
                          <span>Returned to Stage {safeStage}</span>
                          <span>&middot;</span>
                          <span>Updated: {new Date(safeUpdated).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 mt-2 sm:mt-0">
                        <button
                          onClick={() => setSessionToHardDelete(session.id)}
                          className="w-full sm:w-auto text-sm font-medium text-slate-500 hover:text-red-600 transition-colors px-3 py-2"
                        >
                          Delete session
                        </button>
                        <button
                          onClick={() => handleContinueSession(session)}
                          disabled={restoringId === session.id}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-600 text-white hover:bg-amber-700 font-semibold rounded-lg transition-colors w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                        >
                          {restoringId === session.id ? 'Restoring...' : 'Revise Session'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={session.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 transition-all hover:shadow-md hover:border-blue-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold uppercase rounded border border-slate-200">
                             Abandoned
                           </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-1 truncate">
                          {formatDraftName(safeCreated || safeUpdated)}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>Stage {safeStage} of 5</span>
                          <span>&middot;</span>
                          <span>Created: {new Date(safeCreated).toLocaleDateString()}</span>
                          <span>&middot;</span>
                          <span>Updated: {new Date(safeUpdated).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 mt-2 sm:mt-0">
                        <button
                          onClick={() => setSessionToHardDelete(session.id)}
                          className="w-full sm:w-auto text-sm font-medium text-slate-500 hover:text-red-600 transition-colors px-3 py-2"
                        >
                          Delete session
                        </button>
                        <button
                          onClick={() => handleContinueSession(session)}
                          disabled={restoringId === session.id}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg transition-colors w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {restoringId === session.id ? "Restoring..." : "Continue with this session"}
                          {restoringId !== session.id && <ArrowRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        isOpen={!!sessionToHardDelete}
        onClose={() => setSessionToHardDelete(null)}
        onConfirm={() => {
          if (sessionToHardDelete) {
            hardDeleteSession.mutate(sessionToHardDelete);
          }
          setSessionToHardDelete(null);
        }}
        title="Delete Permanently"
        confirmText={hardDeleteSession.isPending ? "Deleting..." : "Delete session"}
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to permanently delete this session? This action cannot be undone.
      </ConfirmModal>

      <ConfirmModal
        isOpen={showEmptyBinConfirm}
        onClose={() => setShowEmptyBinConfirm(false)}
        onConfirm={() => {
          abandonedSessions.forEach((session) => hardDeleteSession.mutate(session.id));
          setShowEmptyBinConfirm(false);
        }}
        title="Empty Session History"
        confirmText="Empty list"
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to permanently delete all {abandonedSessions.length} abandoned sessions in your history? This action cannot be undone.
      </ConfirmModal>
    </div>
  );
}
