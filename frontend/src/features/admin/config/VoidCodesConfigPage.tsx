// frontend/src/features/admin/config/VoidCodesConfigPage.tsx
import React, { useState } from 'react';
import { useAdminVoidCodes, useSaveAdminVoidCode, useDeleteAdminVoidCode } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { DataTable } from '@/components/layout/Table';
import { ArrowLeft, AlertOctagon, Plus, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VoidCodesConfigPage() {
  const { data: voidCodes, isLoading } = useAdminVoidCodes();
  const saveVoidCode = useSaveAdminVoidCode();
  const deleteVoidCode = useDeleteAdminVoidCode();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ id: '', code: '', name: '', description: '', severity: 'MEDIUM', sortOrder: 0, isActive: true });

  const resetForm = () => {
    setFormData({ id: '', code: '', name: '', description: '', severity: 'MEDIUM', sortOrder: (voidCodes?.length || 0) + 1, isActive: true });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleEdit = (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    setIsCreating(false);
  };

  const handleSave = () => {
    saveVoidCode.mutate(formData, {
      onSuccess: resetForm
    });
  };

  const columns = [
    { key: 'code', label: 'Code', render: (v: any) => <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200">{v.code}</span> },
    { key: 'name', label: 'Name & Desc', render: (v: any) => (
      <div>
        <div className="font-bold text-slate-900">{v.name}</div>
        <div className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{v.description}</div>
      </div>
    )},
    { key: 'severity', label: 'Severity', render: (v: any) => {
      const colors = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-blue-100 text-blue-700' } as any;
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colors[v.severity] || colors.LOW}`}>{v.severity}</span>
    }},
    { key: 'status', label: 'Status', render: (v: any) => (
      v.isActive 
        ? <span className="text-[10px] uppercase font-bold text-emerald-600">Active</span>
        : <span className="text-[10px] uppercase font-bold text-slate-400">Inactive</span>
    )},
    { key: 'actions', label: '', render: (v: any) => (
      <div className="flex justify-end gap-2">
        <button onClick={() => handleEdit(v)} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded"><Edit2 size={16} /></button>
        <button onClick={() => setDeleteId(v.id)} className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded"><Trash2 size={16} /></button>
      </div>
    )}
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Void Codes</h1>
            <p className="text-slate-500">Manage elicitation gap taxonomy.</p>
          </div>
        </div>
        {!isCreating && !editingId && (
          <Button onClick={() => { resetForm(); setIsCreating(true); }} className="gap-2">
            <Plus size={16} /> Add Void Code
          </Button>
        )}
      </div>

      {(isCreating || editingId) && (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-6 animate-in slide-in-from-top-2">
          <h3 className="font-bold text-slate-800 mb-4">{editingId ? 'Edit Void Code' : 'New Void Code'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code (Const)</label>
              <input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} disabled={!!editingId} className="w-full p-2 border rounded-lg font-mono text-sm" placeholder="e.g. NO_GROUND_TRUTH" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Severity</label>
              <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="w-full p-2 border rounded-lg text-sm">
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name / Label</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Human readable name" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description / Advisory Rule</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded-lg text-sm h-20" placeholder="Explain what this gap means..." />
            </div>
            {editingId && (
              <div className="md:col-span-2 flex items-center gap-2">
                 <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                 <label className="text-sm font-semibold">Active</label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saveVoidCode.isPending || !formData.code || !formData.name}>
              {saveVoidCode.isPending ? 'Saving...' : 'Save Void Code'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner size="lg" /></div>
      ) : (
        <DataTable 
          columns={columns} 
          data={voidCodes || []} 
          keyExtractor={(v: any) => v.id} 
          emptyState={<div className="text-center p-12 bg-white rounded-xl border border-dashed text-slate-500">No void codes found.</div>} 
        />
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if(deleteId) deleteVoidCode.mutate(deleteId); setDeleteId(null); }}
        title="Delete Void Code"
        confirmText="Delete"
        isDestructive
      >
        Are you sure? This will remove the taxonomy definition entirely. If it's currently in use by an active session, consider setting it to Inactive instead.
      </ConfirmModal>
    </div>
  );
}