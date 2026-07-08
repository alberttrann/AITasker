import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Plus, Edit2, Check, X, Shield, Package, Trash2, Power } from 'lucide-react';
import DashboardGreeting from '@/components/layout/DashboardGreeting';
import { formatVND } from '@/lib/utils';

interface SubPackage {
  id: string;
  role: string;
  name: string;
  priceVnd: number;
  durationMonths: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SubscriptionPackagesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<SubPackage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'CEO',
    priceVnd: 0,
    durationMonths: 1,
    isActive: true
  });

  const { data: packages, isLoading } = useQuery<SubPackage[]>({
    queryKey: ['admin-subscription-packages'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/subscriptions/packages');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiClient.post('/admin/subscriptions/packages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      setIsModalOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiClient.put(`/admin/subscriptions/packages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      setIsModalOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setEditingPkg(null);
    setFormData({ name: '', role: 'CEO', priceVnd: 0, durationMonths: 1, isActive: true });
  };

  const handleEdit = (pkg: SubPackage) => {
    setEditingPkg(pkg);
    setFormData({
      name: pkg.name,
      role: pkg.role,
      priceVnd: pkg.priceVnd,
      durationMonths: pkg.durationMonths,
      isActive: pkg.isActive
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPkg) {
      updateMutation.mutate({ 
        id: editingPkg.id, 
        data: {
          name: formData.name,
          priceVnd: formData.priceVnd,
          durationMonths: formData.durationMonths,
          isActive: formData.isActive
        }
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (pkg: SubPackage) => {
    updateMutation.mutate({
      id: pkg.id,
      data: { isActive: !pkg.isActive }
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-md sm:p-lg">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-headline font-bold text-slate-900 mb-1">Subscription Packages</h1>
          <p className="text-slate-500">Manage pricing and durations for platform subscriptions.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm hover:shadow-md"
        >
          <Plus size={18} />
          Create Package
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages?.map((pkg) => (
            <div key={pkg.id} className={`bg-white rounded-2xl border ${pkg.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-200/50 bg-slate-50 opacity-80'} p-6 transition-all hover:shadow-md flex flex-col`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${pkg.isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                    <Package size={20} />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${pkg.role === 'CEO' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pkg.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleActive(pkg)}
                    title={pkg.isActive ? "Deactivate Package" : "Activate Package"}
                    className={`p-1.5 rounded-md transition-colors ${pkg.isActive ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                  >
                    <Power size={18} />
                  </button>
                  <button 
                    onClick={() => handleEdit(pkg)}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{pkg.name}</h3>
              <p className={`text-sm mb-4 ${pkg.isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                {pkg.isActive ? 'Active and available for purchase' : 'Currently inactive'}
              </p>
              
              <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-headline">
                    {formatVND(pkg.priceVnd)}
                  </div>
                  <div className="text-sm font-medium text-slate-500">
                    for {pkg.durationMonths} month{pkg.durationMonths > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!packages || packages.length === 0) && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No packages yet</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Create your first subscription package to allow users to subscribe to the platform.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold font-headline text-slate-900">
                {editingPkg ? 'Edit Package' : 'Create Package'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Package Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="e.g. Standard 6-Month Plan"
                  />
                </div>
                
                {!editingPkg && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="CEO">CEO</option>
                      <option value="EXPERT">Expert</option>
                    </select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (VND)</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="1000"
                      value={formData.priceVnd}
                      onChange={e => setFormData({...formData, priceVnd: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Months)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={formData.durationMonths}
                      onChange={e => setFormData({...formData, durationMonths: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {editingPkg && (
                  <div className="flex items-center gap-3 pt-2">
                    <input 
                      type="checkbox" 
                      id="isActive"
                      checked={formData.isActive}
                      onChange={e => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Package is active
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                  )}
                  {editingPkg ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
