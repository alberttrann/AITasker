import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { Plus, Edit2, Trash2, ArrowLeft, Layers, MessageSquare, ChevronRight, GripVertical, Check, Save } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export default function ArchetypeConfigPage() {
  const queryClient = useQueryClient();
  const [selectedArchetypeCode, setSelectedArchetypeCode] = useState<string | null>(null);

  // Form states for inline editing
  const [editingArchId, setEditingArchId] = useState<string | null>(null);
  const [isCreatingArch, setIsCreatingArch] = useState(false);
  const [archFormData, setArchFormData] = useState({ id: '', code: '', name: '', description: '', sortOrder: 0, isActive: true });
  const [deleteArchId, setDeleteArchId] = useState<string | null>(null);

  const [editingProbeId, setEditingProbeId] = useState<string | null>(null);
  const [isCreatingProbe, setIsCreatingProbe] = useState(false);
  const [probeFormData, setProbeFormData] = useState({ id: '', questionText: '', displayOrder: 0, isActive: true });
  const [deleteProbeId, setDeleteProbeId] = useState<string | null>(null);

  // Drag and drop states for Probes
  const [draggedProbeId, setDraggedProbeId] = useState<string | null>(null);
  const [dragOverProbeId, setDragOverProbeId] = useState<string | null>(null);
  const [isReorderingProbes, setIsReorderingProbes] = useState(false);
  const [localProbes, setLocalProbes] = useState<any[]>([]);

  // --- QUERIES ---
  const { data: archetypes, isLoading: loadingArchs } = useQuery({
    queryKey: ['admin-config-archetypes'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/config/archetypes');
      return res.data;
    }
  });

  const { data: probeQuestions, isLoading: loadingProbes } = useQuery({
    queryKey: ['admin-config-probes', selectedArchetypeCode],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/config/probe-questions?archetypeCode=${selectedArchetypeCode}`);
      return res.data;
    },
    enabled: !!selectedArchetypeCode
  });

  useEffect(() => {
    if (probeQuestions) {
      setLocalProbes([...probeQuestions].sort((a: any, b: any) => a.displayOrder - b.displayOrder));
    }
  }, [probeQuestions]);

  const isProbeOrderDirty = useMemo(() => {
    if (!probeQuestions || localProbes.length !== probeQuestions.length) return false;
    const originalSorted = [...probeQuestions].sort((a: any, b: any) => a.displayOrder - b.displayOrder);
    return localProbes.some((lp, idx) => lp.id !== originalSorted[idx].id);
  }, [probeQuestions, localProbes]);

  // --- MUTATIONS: ARCHETYPES ---
  const saveArchMutation = useMutation({
    mutationFn: async (data: typeof archFormData) => {
      if (isCreatingArch) {
        const nextSortOrder = archetypes && archetypes.length > 0 ? Math.max(...archetypes.map((a: any) => a.sortOrder || 0)) + 1 : 1;
        const nextCodeNum = archetypes && archetypes.length > 0 ? Math.max(...archetypes.map((a: any) => {
          const num = parseInt(a.code);
          return isNaN(num) ? 0 : num;
        })) + 1 : 1;
        const payload = { code: nextCodeNum.toString(), name: data.name, description: data.description, sortOrder: nextSortOrder };
        return apiClient.post(`/admin/config/archetypes`, payload);
      } else {
        const payload = { name: data.name, description: data.description, sortOrder: data.sortOrder, isActive: data.isActive };
        return apiClient.put(`/admin/config/archetypes/${data.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-archetypes'] });
      setIsCreatingArch(false);
      setEditingArchId(null);
    }
  });

  const deleteArchMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/config/archetypes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-archetypes'] });
      setDeleteArchId(null);
      if (selectedArchetypeCode && archetypes?.find((a: any) => a.id === deleteArchId)?.code === selectedArchetypeCode) {
        setSelectedArchetypeCode(null);
      }
    }
  });

  // --- MUTATIONS: PROBES ---
  const saveProbeMutation = useMutation({
    mutationFn: async (data: typeof probeFormData) => {
      if (isCreatingProbe) {
        const payload = { archetypeCode: selectedArchetypeCode, questionText: data.questionText, displayOrder: data.displayOrder };
        return apiClient.post(`/admin/config/probe-questions`, payload);
      } else {
        const payload = { questionText: data.questionText, displayOrder: data.displayOrder, isActive: data.isActive };
        return apiClient.put(`/admin/config/probe-questions/${data.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-probes', selectedArchetypeCode] });
      setIsCreatingProbe(false);
      setEditingProbeId(null);
    }
  });

  const deleteProbeMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/config/probe-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-probes', selectedArchetypeCode] });
      setDeleteProbeId(null);
    }
  });

  // --- HANDLERS ---
  const handleEditArch = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setIsCreatingArch(false);
    setArchFormData(item);
    setEditingArchId(item.id);
  };

  const handleCancelArchEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreatingArch(false);
    setEditingArchId(null);
  };

  const handleEditProbe = (item: any) => {
    setIsCreatingProbe(false);
    setProbeFormData({ ...item });
    setEditingProbeId(item.id);
  };

  // Drag handlers for probes
  const handleProbeDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProbeId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProbeDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverProbeId !== id) {
      setDragOverProbeId(id);
    }
  };

  const handleProbeDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverProbeId === id) {
      setDragOverProbeId(null);
    }
  };

  const handleProbeDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverProbeId(null);
    
    if (!draggedProbeId || draggedProbeId === targetId) {
      setDraggedProbeId(null);
      return;
    }

    const sourceIndex = localProbes.findIndex(i => i.id === draggedProbeId);
    const targetIndex = localProbes.findIndex(i => i.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedProbeId(null);
      return;
    }

    const newItems = [...localProbes];
    const [removed] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      displayOrder: index + 1
    }));
    
    setLocalProbes(updatedItems);
    setDraggedProbeId(null);
  };

  const handleProbeDragEnd = () => {
    setDraggedProbeId(null);
    setDragOverProbeId(null);
  };

  const handleSaveProbeOrder = async () => {
    if (!probeQuestions) return;
    setIsReorderingProbes(true);
    
    const originalSorted = [...probeQuestions].sort((a: any, b: any) => a.displayOrder - b.displayOrder);
    const changedItems = localProbes.filter((item, index) => 
      originalSorted[index].id !== item.id || originalSorted[index].displayOrder !== item.displayOrder
    );
    
    try {
      for (const item of changedItems) {
        await apiClient.put(`/admin/config/probe-questions/${item.id}`, {
          questionText: item.questionText,
          displayOrder: item.displayOrder,
          isActive: item.isActive
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-config-probes', selectedArchetypeCode] });
    } catch (error) {
      console.error('Reordering failed', error);
      await queryClient.invalidateQueries({ queryKey: ['admin-config-probes', selectedArchetypeCode] });
    } finally {
      setIsReorderingProbes(false);
    }
  };

  const sortedArchetypes = archetypes ? [...archetypes].sort((a: any, b: any) => a.sortOrder - b.sortOrder) : [];
  const selectedArchData = sortedArchetypes.find(a => a.code === selectedArchetypeCode);

  const renderArchForm = (mode: 'create' | 'edit') => (
    <div className="p-4 bg-slate-50 border-b border-slate-200">
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
          <input value={archFormData.name} onChange={e => setArchFormData(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium" placeholder="e.g. AI Search" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
          <textarea value={archFormData.description} onChange={e => setArchFormData(f => ({...f, description: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm min-h-[60px]" placeholder="Brief description..." />
        </div>
        {mode === 'edit' && (
          <div className="flex gap-4">
            <div className="flex-1 flex items-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setArchFormData(f => ({...f, isActive: !f.isActive}))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  archFormData.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-sm bg-white transition-transform duration-300 z-10 ${
                    archFormData.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={handleCancelArchEdit} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors">Cancel</button>
          <button onClick={(e) => { e.stopPropagation(); saveArchMutation.mutate(archFormData); }} disabled={saveArchMutation.isPending} className="px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded transition-colors disabled:opacity-50 flex items-center gap-1">
            {saveArchMutation.isPending ? 'Saving...' : <><Check size={14} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );

  const renderProbeForm = (mode: 'create' | 'edit') => (
    <div className={`p-5 ${mode === 'create' ? 'bg-slate-50 border-b border-slate-200' : 'bg-blue-50/50 rounded-xl border border-blue-200'}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Question Text</label>
          <textarea 
            value={probeFormData.questionText} 
            onChange={e => setProbeFormData(f => ({...f, questionText: e.target.value}))} 
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm min-h-[80px]" 
            placeholder="Type question here..." 
            autoFocus
          />
        </div>
        <div className="flex gap-4">
          {mode === 'edit' && (
            <div className="flex-1 flex items-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setProbeFormData(f => ({...f, isActive: !f.isActive}))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  probeFormData.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-sm bg-white transition-transform duration-300 z-10 ${
                    probeFormData.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => { setIsCreatingProbe(false); setEditingProbeId(null); }} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors">Cancel</button>
          <button onClick={() => saveProbeMutation.mutate(probeFormData)} disabled={saveProbeMutation.isPending} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 flex items-center gap-1">
            {saveProbeMutation.isPending ? 'Saving...' : <><Check size={14} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Archetypes & Probes</h1>
            <p className="text-slate-500">Configure project archetypes and their dynamic elicitation questions.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT COLUMN: ARCHETYPES */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 sticky top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              Archetypes
            </h2>
            {!isCreatingArch && (
              <button 
                onClick={() => {
                  setEditingArchId(null);
                  setArchFormData({ id: '', code: '', name: '', description: '', sortOrder: sortedArchetypes.length + 1, isActive: true });
                  setIsCreatingArch(true);
                }}
                className="p-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                title="Add Archetype"
              >
                <Plus size={18} />
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[80vh]">
            {isCreatingArch && renderArchForm('create')}

            {loadingArchs ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
              </div>
            ) : sortedArchetypes.length === 0 && !isCreatingArch ? (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <Layers size={32} className="text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm font-medium">No archetypes found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-y-auto">
                {sortedArchetypes.map(arch => {
                  const isSelected = selectedArchetypeCode === arch.code;
                  const isEditing = editingArchId === arch.id;

                  if (isEditing) {
                    return <div key={arch.id}>{renderArchForm('edit')}</div>;
                  }

                  return (
                    <div 
                      key={arch.id} 
                      onClick={() => {
                        setSelectedArchetypeCode(arch.code);
                        setIsCreatingProbe(false);
                        setEditingProbeId(null);
                      }}
                      className={`p-4 cursor-pointer transition-colors group flex items-start gap-3 ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-slate-900 truncate">{arch.name}</span>
                          {!arch.isActive && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">Inactive</span>}
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2">{arch.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1">
                          <button onClick={(e) => handleEditArch(e, arch)} className="p-1.5 text-slate-400 hover:text-primary bg-white rounded shadow-sm border border-slate-100"><Edit2 size={14} /></button>
                        </div>
                        <ChevronRight size={16} className={`mt-2 ${isSelected ? 'text-primary' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PROBE QUESTIONS */}
        <div className="w-full lg:w-2/3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={20} className={selectedArchetypeCode ? 'text-blue-500' : 'text-slate-400'} />
              Probe Questions {selectedArchData && <span className="text-slate-500 font-normal ml-2">— {selectedArchData.name}</span>}
            </h2>
            <div className="flex items-center gap-3">
              {isProbeOrderDirty && (
                <button 
                  onClick={handleSaveProbeOrder}
                  disabled={isReorderingProbes}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70"
                >
                  {isReorderingProbes ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                  ) : <Save size={14} />}
                  {isReorderingProbes ? 'Saving...' : 'Save Order'}
                </button>
              )}
              {selectedArchetypeCode && !isCreatingProbe && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setEditingProbeId(null);
                    setProbeFormData({ id: '', questionText: '', displayOrder: localProbes.length + 1, isActive: true });
                    setIsCreatingProbe(true);
                  }}
                  className="gap-2"
                >
                  <Plus size={16} /> Add Question
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col relative">
            {isReorderingProbes && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-2xl">
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin"></div>
              </div>
            )}

            {!selectedArchetypeCode ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-4">
                  <ArrowLeft size={24} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Select an Archetype</h3>
                <p className="text-slate-500 max-w-sm">Choose a project archetype from the list to view and manage its specific probe questions.</p>
              </div>
            ) : (
              <>
                {isCreatingProbe && renderProbeForm('create')}
                
                {loadingProbes ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : localProbes.length === 0 && !isCreatingProbe ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquare size={40} className="text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 mb-1">No questions yet</h3>
                    <p className="text-slate-500 text-sm mb-4">This archetype currently has no probe questions configured.</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3 relative">
                    {localProbes.map((probe, idx) => {
                      const isEditing = editingProbeId === probe.id;
                      const isDragging = draggedProbeId === probe.id;
                      const isDragOver = dragOverProbeId === probe.id && !isDragging;

                      if (isEditing) {
                         return <div key={probe.id}>{renderProbeForm('edit')}</div>;
                      }

                      return (
                        <div 
                          key={probe.id} 
                          className={`flex items-start gap-4 p-4 rounded-xl border bg-white transition-all group
                            ${isDragging ? 'opacity-40 scale-[0.99] border-slate-200 shadow-inner' : 'border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md'}
                            ${isDragOver ? 'shadow-[0_-3px_0_0_#3b82f6] !border-t-blue-500 z-10 relative' : ''}
                          `}
                          draggable={editingProbeId === null}
                          onDragStart={(e) => handleProbeDragStart(e, probe.id)}
                          onDragOver={(e) => handleProbeDragOver(e, probe.id)}
                          onDragLeave={(e) => handleProbeDragLeave(e, probe.id)}
                          onDrop={(e) => handleProbeDrop(e, probe.id)}
                          onDragEnd={handleProbeDragEnd}
                        >
                          <div className="mt-1 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                            <GripVertical size={18} />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0">
                            {probe.displayOrder ?? (idx + 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-base mb-1">{probe.questionText}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${probe.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                {probe.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEditProbe(probe)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
