import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { useDomains } from '@/hooks/use-config';
import { Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/layout/Table';

export default function DomainSeamConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'domains'|'seams'>('domains');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create'|'edit'>('create');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
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

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (modalMode === 'create') {
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
      setIsModalOpen(false);
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
    setFormData(item);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'sortOrder', label: 'Order', sortable: true },
    { key: 'isActive', label: 'Status', sortable: true, render: (row: any) => row.isActive ? <span className="text-emerald-600 font-bold text-xs uppercase px-2 py-1 bg-emerald-50 rounded">Active</span> : <span className="text-slate-500 font-bold text-xs uppercase px-2 py-1 bg-slate-100 rounded">Inactive</span> },
    { key: 'actions', label: '', sortable: false, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => handleEdit(row)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded"><Edit2 size={16} /></button>
        <button onClick={() => setDeleteId(row.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
      </div>
    )}
  ];

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Domain & Seam Config</h1>
            <p className="text-slate-500">Manage expert domains and technical seams.</p>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setModalMode('create'); setIsModalOpen(true); }}
          className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm hover:shadow-md"
        >
          <Plus size={18} />
          Create {activeTab === 'domains' ? 'Domain' : 'Seam'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button 
            className={`flex-1 flex justify-center items-center gap-2 py-4 font-semibold text-base transition-colors border-b-2 ${activeTab === 'domains' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('domains')}
          >
            Expert Domains
          </button>
          <button 
            className={`flex-1 flex justify-center items-center gap-2 py-4 font-semibold text-base transition-colors border-b-2 ${activeTab === 'seams' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('seams')}
          >
            Technical Seams
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
            </div>
          ) : (
            <DataTable 
              columns={columns} 
              data={items || []} 
              keyExtractor={(item: any) => item.id} 
            />
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {modalMode === 'create' ? 'Create' : 'Edit'} {activeTab === 'domains' ? 'Domain' : 'Seam'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Code</label>
              {activeTab === 'domains' ? (
                <input value={formData.code} onChange={e => setFormData(f => ({...f, code: e.target.value}))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm uppercase" placeholder="e.g. HEALTHCARE" />
              ) : (
                <div className="flex items-center gap-2">
                  <select 
                    value={formData.code.split('↔')[0] || ''} 
                    onChange={e => {
                      const parts = formData.code.split('↔');
                      setFormData(f => ({...f, code: `${e.target.value.toUpperCase()}↔${parts[1] || ''}`}));
                    }} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm uppercase appearance-none" 
                  >
                    <option value="" disabled>Domain 1...</option>
                    {(domainsList || []).map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold px-2">↔</span>
                  <select 
                    value={formData.code.split('↔')[1] || ''} 
                    onChange={e => {
                      const parts = formData.code.split('↔');
                      setFormData(f => ({...f, code: `${parts[0] || ''}↔${e.target.value.toUpperCase()}`}));
                    }} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm uppercase appearance-none" 
                  >
                    <option value="" disabled>Domain 2...</option>
                    {(domainsList || []).map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" placeholder="e.g. Healthcare & Pharma" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm min-h-[80px]" placeholder="Description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sort Order</label>
                <input type="number" value={formData.sortOrder} onChange={e => setFormData(f => ({...f, sortOrder: parseInt(e.target.value) || 0}))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData(f => ({...f, isActive: e.target.checked}))} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-8">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50">
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        title="Delete Item"
        message={`Are you sure you want to delete this ${activeTab === 'domains' ? 'domain' : 'seam'}? This action cannot be undone.`}
        confirmText={deleteMutation.isPending ? "Deleting..." : "Delete"}
        isDestructive={true}
      />
    </div>
  );
}
