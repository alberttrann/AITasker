import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { useDomains } from '@/hooks/use-config';
import { Plus, Edit2, Trash2, ArrowLeft, Globe, Network, Check, GripVertical, Save } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Modal';

export default function DomainSeamConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'domains'|'seams'>('domains');
  
  // Form states for inline editing
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Drag and drop states
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [localItems, setLocalItems] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({ id: '', code: '', name: '', description: '', sortOrder: 0, isActive: true });

  const resetForm = () => setFormData({ id: '', code: '', name: '', description: '', sortOrder: 0, isActive: true });

  const { data: domainsList } = useDomains();

  const { data: items, isLoading } = useQuery({
    queryKey: ['admin-config', activeTab],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/config/${activeTab}`);
      return res.data;
    }
  });

  // Sync local items when API data loads
  useEffect(() => {
    if (items) {
      setLocalItems([...items].sort((a: any, b: any) => a.sortOrder - b.sortOrder));
    }
  }, [items]);

  const isOrderDirty = useMemo(() => {
    if (!items || localItems.length !== items.length) return false;
    const originalSorted = [...items].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    return localItems.some((li, idx) => li.id !== originalSorted[idx].id);
  }, [items, localItems]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (isCreating) {
        const payload = {
          code: data.code,
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder
        };
        return apiClient.post(`/admin/config/${activeTab}`, payload);
      } else {
        const payload = {
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder,
          isActive: data.isActive
        };
        return apiClient.put(`/admin/config/${activeTab}/${data.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', activeTab] });
      setIsCreating(false);
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/config/${activeTab}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', activeTab] });
      setDeleteId(null);
    }
  });

  const handleEdit = (item: any) => {
    setIsCreating(false);
    setFormData(item);
    setEditingId(item.id);
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const sourceIndex = localItems.findIndex(i => i.id === draggedId);
    const targetIndex = localItems.findIndex(i => i.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newItems = [...localItems];
    const [removed] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    
    // Assign new sequential sort orders internally for the local list
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      sortOrder: index + 1
    }));
    
    setLocalItems(updatedItems);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleSaveOrder = async () => {
    if (!items) return;
    setIsReordering(true);
    
    const originalSorted = [...items].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    const changedItems = localItems.filter((item, index) => 
      originalSorted[index].id !== item.id || originalSorted[index].sortOrder !== item.sortOrder
    );
    
    try {
      // Fire sequential updates
      for (const item of changedItems) {
        await apiClient.put(`/admin/config/${activeTab}/${item.id}`, {
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          isActive: item.isActive
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-config', activeTab] });
    } catch (error) {
      console.error('Reordering failed', error);
      // Revert cache on error by refetching
      await queryClient.invalidateQueries({ queryKey: ['admin-config', activeTab] });
    } finally {
      setIsReordering(false);
    }
  };

  const renderInlineForm = (mode: 'create' | 'edit') => (
    <div className={`p-4 ${mode === 'create' ? 'bg-primary/5 border-b border-primary/20' : 'bg-slate-50/80 border-y border-slate-200 shadow-inner'}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Code</label>
          {activeTab === 'domains' ? (
            <input 
              value={formData.code} 
              onChange={e => setFormData(f => ({...f, code: e.target.value}))} 
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs uppercase font-mono" 
              placeholder="e.g. HEALTHCARE" 
              disabled={mode === 'edit'} 
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <select 
                value={formData.code.split('↔')[0] || ''} 
                onChange={e => {
                  const parts = formData.code.split('↔');
                  setFormData(f => ({...f, code: `${e.target.value.toUpperCase()}↔${parts[1] || ''}`}));
                }} 
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs uppercase" 
                disabled={mode === 'edit'}
              >
                <option value="" disabled>Domain 1...</option>
                {(domainsList || []).map(d => (
                  <option key={d.code} value={d.code}>{d.code}</option>
                ))}
              </select>
              <div className="text-slate-400 font-bold text-center text-[10px] leading-none">↕</div>
              <select 
                value={formData.code.split('↔')[1] || ''} 
                onChange={e => {
                  const parts = formData.code.split('↔');
                  setFormData(f => ({...f, code: `${parts[0] || ''}↔${e.target.value.toUpperCase()}`}));
                }} 
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs uppercase" 
                disabled={mode === 'edit'}
              >
                <option value="" disabled>Domain 2...</option>
                {(domainsList || []).map(d => (
                  <option key={d.code} value={d.code}>{d.code}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="md:col-span-3 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
            <input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold" placeholder={activeTab === 'domains' ? "e.g. Healthcare & Pharma" : "e.g. Health-Tech Seam"} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs min-h-[40px]" placeholder="Brief description..." />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div>
              {mode === 'edit' && (
                <div className="flex items-center gap-3 mt-1">
                  <button 
                    type="button"
                    onClick={() => setFormData(f => ({...f, isActive: !f.isActive}))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                      formData.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-sm bg-white transition-transform duration-300 z-10 ${
                        formData.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCancelEdit} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors shadow-sm">Cancel</button>
              <button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1">
                {saveMutation.isPending ? 'Saving...' : <><Check size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Domain & Seam Config</h1>
            <p className="text-slate-500">Manage expert domains and technical seams.</p>
          </div>
        </div>
        
        {isOrderDirty && (
          <button 
            onClick={handleSaveOrder}
            disabled={isReordering}
            className="sm:ml-auto flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70"
          >
            {isReordering ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            ) : <Save size={18} />}
            {isReordering ? 'Saving Order...' : 'Save New Order'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button 
            className={`flex-1 flex justify-center items-center gap-2 py-3.5 font-bold text-sm transition-colors border-b-2 ${activeTab === 'domains' ? 'border-primary text-primary bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
            onClick={() => { setActiveTab('domains'); setIsCreating(false); setEditingId(null); }}
          >
            <Globe size={18} /> Expert Domains
          </button>
          <button 
            className={`flex-1 flex justify-center items-center gap-2 py-3.5 font-bold text-sm transition-colors border-b-2 ${activeTab === 'seams' ? 'border-primary text-primary bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
            onClick={() => { setActiveTab('seams'); setIsCreating(false); setEditingId(null); }}
          >
            <Network size={18} /> Technical Seams
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            {activeTab === 'domains' ? 'Configured Domains' : 'Configured Seams'}
          </h2>
          {!isCreating && (
            <button 
              onClick={() => {
                resetForm();
                setFormData(f => ({ ...f, sortOrder: localItems.length + 1 }));
                setEditingId(null);
                setIsCreating(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-md hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Plus size={14} /> Create {activeTab === 'domains' ? 'Domain' : 'Seam'}
            </button>
          )}
        </div>

        {isCreating && renderInlineForm('create')}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
          </div>
        ) : localItems.length === 0 && !isCreating ? (
          <div className="p-16 flex flex-col items-center justify-center text-center bg-slate-50/50">
            {activeTab === 'domains' ? <Globe size={48} className="text-slate-200 mb-4" /> : <Network size={48} className="text-slate-200 mb-4" />}
            <h3 className="text-lg font-bold text-slate-800 mb-2">No {activeTab === 'domains' ? 'domains' : 'seams'} found</h3>
            <p className="text-slate-500 mb-6 text-sm">Get started by creating your first {activeTab === 'domains' ? 'domain' : 'seam'}.</p>
            <button 
              onClick={() => {
                resetForm();
                setFormData(f => ({ ...f, sortOrder: 1 }));
                setIsCreating(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Plus size={18} /> Create {activeTab === 'domains' ? 'Domain' : 'Seam'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold w-12 text-center"></th>
                  <th className="px-2 py-3 font-bold w-12 text-center">Order</th>
                  <th className="px-4 py-3 font-bold w-48">Code</th>
                  <th className="px-4 py-3 font-bold">Name & Description</th>
                  <th className="px-4 py-3 font-bold w-24 text-center">Status</th>
                  <th className="px-4 py-3 font-bold w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white relative">
                {localItems.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const isDragging = draggedId === item.id;
                  const isDragOver = dragOverId === item.id && !isDragging;

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-slate-50/30">
                        <td colSpan={6} className="p-0">
                          {renderInlineForm('edit')}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50 transition-colors group 
                        ${isDragging ? 'opacity-40 bg-slate-100 scale-[0.99] shadow-inner' : ''}
                        ${isDragOver ? 'shadow-[inset_0_2px_0_0_#3b82f6] z-10 relative' : ''}
                      `}
                      draggable={editingId === null}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={(e) => handleDragLeave(e, item.id)}
                      onDrop={(e) => handleDrop(e, item.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="px-4 py-3 text-slate-300 cursor-grab hover:text-slate-500 text-center active:cursor-grabbing">
                        <GripVertical size={16} />
                      </td>
                      <td className="px-2 py-3 text-sm text-slate-500 font-medium text-center">
                        {item.sortOrder ?? (idx + 1)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                          {item.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-sm mb-0.5">{item.name}</div>
                        {item.description && <div className="text-xs text-slate-500 truncate max-w-md">{item.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isActive ? (
                          <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 tracking-wide">Active</span>
                        ) : (
                          <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 tracking-wide">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit"><Edit2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
