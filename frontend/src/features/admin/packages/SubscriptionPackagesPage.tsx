import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { Plus, Edit2, Check, X, Package, Trash2, ArrowLeft } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/Modal';
import { DataList } from '@/components/layout/Table';
import { useSubscriptionPackages, useCreateSubscriptionPackage, useUpdateSubscriptionPackage, useDeleteSubscriptionPackage } from '@/hooks/use-admin';

import type { SubPackage } from '@/types/api.types';

export default function SubscriptionPackagesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'duration_asc' | 'duration_desc'>('price_asc');
  const [deletePkg, setDeletePkg] = useState<SubPackage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'CLIENT',
    priceVnd: 0,
    durationMonths: 1,
    isActive: false
  });

  const { data: packages, isLoading } = useSubscriptionPackages();

  const sortedPackages = React.useMemo(() => {
    if (!packages) return [];
    return [...packages].sort((a, b) => {
      if (sort === 'price_asc') return a.priceVnd - b.priceVnd;
      if (sort === 'price_desc') return b.priceVnd - a.priceVnd;
      if (sort === 'duration_asc') return a.durationMonths - b.durationMonths;
      if (sort === 'duration_desc') return b.durationMonths - a.durationMonths;
      return 0;
    });
  }, [packages, sort]);

  const createMutation = useCreateSubscriptionPackage({
    onSuccess: () => {
      setIsCreating(false);
      resetForm();
    }
  });

  const updateMutation = useUpdateSubscriptionPackage({
    onSuccess: () => {
      setEditingId(null);
      resetForm();
    }
  });

  const deleteMutation = useDeleteSubscriptionPackage({
    onSuccess: () => {
      setDeletePkg(null);
    },
    onError: (error: any) => {
      console.error('Delete failed', error);
      if (error.response?.data?.message?.includes('foreign key constraint')) {
        setDeleteError('This package is currently in use by active subscriptions and cannot be deleted. Try setting it to inactive instead.');
      } else {
        const msg = error.response?.data?.message || 'Failed to delete package.';
        setDeleteError(Array.isArray(msg) ? msg[0] : msg);
      }
      setDeletePkg(null);
    }
  });



  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', role: 'CLIENT', priceVnd: 0, durationMonths: 1, isActive: false });
  };

  const handleEdit = (pkg: SubPackage) => {
    setIsCreating(false);
    setEditingId(pkg.id);
    setFormData({
      name: pkg.name,
      role: pkg.role,
      priceVnd: pkg.priceVnd,
      durationMonths: pkg.durationMonths,
      isActive: pkg.isActive
    });
  };

  const toggleActive = (pkg: SubPackage) => {
    updateMutation.mutate({
      id: pkg.id,
      data: { isActive: !pkg.isActive }
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const clientPackages = sortedPackages.filter(p => p.role === 'CLIENT' || p.role === 'CEO');
  const expertPackages = sortedPackages.filter(p => p.role === 'EXPERT');

  const renderInlineForm = (mode: 'create' | 'edit') => (
    <div className={`p-5 ${mode === 'create' ? 'bg-primary/5 border-b border-primary/20 rounded-xl mb-4' : 'bg-slate-50 border border-slate-200 rounded-xl mb-4 shadow-inner'}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Package Name</label>
          <input 
            value={formData.name} 
            onChange={e => setFormData(f => ({...f, name: e.target.value}))} 
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium" 
            placeholder="e.g. Standard 6-Month Plan" 
            autoFocus
          />
        </div>
        
        {mode === 'create' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Role</label>
            <select
              value={formData.role}
              onChange={e => setFormData(f => ({...f, role: e.target.value}))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            >
              <option value="CLIENT">Client</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Price (VND)</label>
            <input 
              type="number" 
              min="0" step="1000"
              value={formData.priceVnd} 
              onChange={e => setFormData(f => ({...f, priceVnd: Number(e.target.value) || 0}))} 
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-mono" 
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Duration (Months)</label>
            <input 
              type="number" 
              min="1"
              value={formData.durationMonths} 
              onChange={e => setFormData(f => ({...f, durationMonths: parseInt(e.target.value) || 1}))} 
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
            />
          </div>
        </div>

        {mode === 'edit' && (
          <div className="flex items-center gap-3 pt-2">
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

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={handleCancelEdit} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors">Cancel</button>
          <button onClick={() => mode === 'edit' ? updateMutation.mutate({ id: editingId!, data: formData }) : createMutation.mutate(formData)} disabled={updateMutation.isPending || createMutation.isPending} className="px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded transition-colors disabled:opacity-50 flex items-center gap-1">
            {(updateMutation.isPending || createMutation.isPending) ? 'Saving...' : <><Check size={14} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPackage = (pkg: SubPackage) => {
    if (editingId === pkg.id) {
      return <div key={pkg.id}>{renderInlineForm('edit')}</div>;
    }

    return (
      <div key={pkg.id} className={`bg-white rounded-2xl border ${pkg.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-200/50 bg-slate-50 opacity-80'} p-6 transition-all hover:shadow-md flex flex-col mb-4`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${pkg.isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
              <Package size={20} />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pkg.role === 'CLIENT' || pkg.role === 'CEO' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {pkg.role === 'CLIENT' ? 'CLIENT' : pkg.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleActive(pkg)}
              title={pkg.isActive ? "Set to Offline" : "Set to Online"}
              className={`relative inline-flex h-6 w-[42px] items-center rounded-full transition-colors duration-300 focus:outline-none ${
                pkg.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              <span
                className={`inline-block h-[18px] w-[18px] transform rounded-full shadow-sm bg-white transition-transform duration-300 z-10 ${
                  pkg.isActive ? 'translate-x-[21px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
            <button 
              onClick={() => handleEdit(pkg)}
              title="Edit Package"
              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
            >
              <Edit2 size={18} />
            </button>
            <button 
              onClick={() => setDeletePkg(pkg)}
              title="Delete Package"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-1">{pkg.name}</h3>
        <p className={`text-sm mb-4 ${pkg.isActive ? 'text-slate-500' : 'text-slate-400'}`}>
          {pkg.isActive ? 'Active and available for purchase' : 'Currently inactive'}
        </p>
        
        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {formatVND(pkg.priceVnd)}
            </div>
            <div className="text-sm font-medium text-slate-500">
              for {pkg.durationMonths} month{pkg.durationMonths > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/config" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Subscription Packages</h1>
            <p className="text-slate-500">Manage pricing and durations for platform subscriptions.</p>
          </div>
        </div>
        {!isCreating && (
          <button 
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            Create Package
          </button>
        )}
      </div>

      {isCreating && renderInlineForm('create')}

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
        </div>
      ) : (
        <DataList
          sortOptions={[
            { label: 'Price (Low to High)', value: 'price_asc' },
            { label: 'Price (High to Low)', value: 'price_desc' },
            { label: 'Duration (Shortest)', value: 'duration_asc' },
            { label: 'Duration (Longest)', value: 'duration_desc' }
          ]}
          currentSort={sort}
          onSortChange={(v) => setSort(v as any)}
          isEmpty={!sortedPackages || sortedPackages.length === 0}
          emptyState={
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No packages yet</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Create your first subscription package to allow users to subscribe to the platform.</p>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                Client Packages
              </h2>
              <div className="flex flex-col">
                {clientPackages.length > 0 ? (
                  clientPackages.map(renderPackage)
                ) : (
                  <div className="text-slate-500 italic p-6 bg-white border border-slate-200 border-dashed rounded-xl text-center">No client packages</div>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                Expert Packages
              </h2>
              <div className="flex flex-col">
                {expertPackages.length > 0 ? (
                  expertPackages.map(renderPackage)
                ) : (
                  <div className="text-slate-500 italic p-6 bg-white border border-slate-200 border-dashed rounded-xl text-center">No expert packages</div>
                )}
              </div>
            </div>
          </div>
        </DataList>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletePkg && !deleteError}
        onClose={() => setDeletePkg(null)}
        onConfirm={() => deletePkg && deleteMutation.mutate(deletePkg.id)}
        title="Delete Package"
        confirmText={deleteMutation.isPending ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        isDestructive={true}
      >
        Are you sure you want to delete <strong className="text-slate-800">{deletePkg?.name}</strong>? This action cannot be undone.
      </ConfirmModal>

      {/* Delete Error Modal */}
      <ConfirmModal
        isOpen={!!deleteError}
        onClose={() => { setDeleteError(null); setDeletePkg(null); }}
        onConfirm={() => { setDeleteError(null); setDeletePkg(null); }}
        title="Cannot Delete Package"
        confirmText="Understood"
        cancelText="Close"
        isInfo={true}
      >
        {deleteError}
      </ConfirmModal>
    </div>
  );
}
