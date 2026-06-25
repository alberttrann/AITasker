import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Pencil, Save, X, LogOut, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

export default function ProfileSettingPage() {
  const { user } = useAuth();
  const store = useAuthStore();
  const navigate = useNavigate();

  // ── State Management ──
  const [originalValues, setOriginalValues] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    companyName: user?.activeRoleProfile?.companyName || '',
    industry: user?.activeRoleProfile?.industry || '',
    ceoName: user?.activeRoleProfile?.ceoName || '',
  });

  const [formValues, setFormValues] = useState({ ...originalValues });
  const [editingField, setEditingField] = useState<keyof typeof formValues | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'save' | 'exit' | null;
  }>({ isOpen: false, type: null });

  // Update state if user data loads slightly after mount
  useEffect(() => {
    if (user) {
      const newVals = { 
        fullName: user.fullName || '', 
        email: user.email || '', 
        phone: user.phone || '',
        companyName: user.activeRoleProfile?.companyName || '',
        industry: user.activeRoleProfile?.industry || '',
        ceoName: user.activeRoleProfile?.ceoName || '',
      };
      setOriginalValues(newVals);
      setFormValues(newVals);
    }
  }, [user]);

  // ── Handlers ──
  const isDirty = 
    originalValues.fullName !== formValues.fullName || 
    originalValues.phone !== formValues.phone ||
    (user?.activeRole === 'CLIENT' && (
      originalValues.companyName !== formValues.companyName ||
      originalValues.industry !== formValues.industry ||
      originalValues.ceoName !== formValues.ceoName
    ));

  const handleEditClick = (field: keyof typeof formValues) => {
    setEditingField(field);
    setTempValue(formValues[field]);
  };

  const handleInlineSave = (field: keyof typeof formValues) => {
    setFormValues((prev) => ({ ...prev, [field]: tempValue }));
    setEditingField(null);
  };

  const handleInlineCancel = () => {
    setEditingField(null);
  };

  // ── Modal Actions ──
  const executeSave = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const payload: Record<string, string> = {};
      
      if (formValues.fullName !== originalValues.fullName) payload.fullName = formValues.fullName;
      if (formValues.phone !== originalValues.phone) payload.phone = formValues.phone;
      
      if (user?.activeRole === 'CLIENT') {
        if (formValues.companyName !== originalValues.companyName) payload.companyName = formValues.companyName;
        if (formValues.industry !== originalValues.industry) payload.industry = formValues.industry;
        if (formValues.ceoName !== originalValues.ceoName) payload.ceoName = formValues.ceoName;
      }
      
      if (Object.keys(payload).length > 0) {
        await apiClient.put('/users/me', payload);
        const { data: userRes } = await apiClient.get('/users/me');
        store.setUser(userRes);
      }
      
      setOriginalValues({ ...formValues }); // Reset dirty state
      setModalConfig({ isOpen: false, type: null });
      
      // Toast would go here
      
      if (modalConfig.type === 'exit') {
        navigate('../profile');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update profile.';
      setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDiscard = () => {
    setFormValues({ ...originalValues }); // Revert all changes
    setModalConfig({ isOpen: false, type: null });
    
    if (modalConfig.type === 'exit') {
      navigate('../profile');
    }
  };

  const handleExitRequest = () => {
    if (isDirty) {
      setModalConfig({ isOpen: true, type: 'exit' });
    } else {
      navigate('../profile');
    }
  };

  // ── Helper Function for Editable Rows ──
  const renderEditableRow = (label: string, fieldKey: keyof typeof formValues, type = 'text', editable = true) => {
    const isEditing = editingField === fieldKey;
    const isModified = formValues[fieldKey] !== originalValues[fieldKey];

    return (
      <div key={fieldKey} className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 px-6 border-b border-slate-100 last:border-0 transition-colors duration-200 ${isModified ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}>
        
        {/* Label Area */}
        <div className="w-full sm:w-1/3 mb-2 sm:mb-0 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">{label}</span>
          {isModified && !isEditing && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Unsaved changes" />
          )}
        </div>

        {/* Input / Value Area */}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {isEditing ? (
            <input
              type={type}
              autoFocus
              value={tempValue}
              onChange={(e) => {
                let val = e.target.value;
                if (fieldKey === 'phone') {
                  val = val.replace(/\D/g, ''); // Strip non-digits
                  if (val.length > 10) val = val.slice(0, 10); // Cap at 10 digits
                }
                setTempValue(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInlineSave(fieldKey);
                if (e.key === 'Escape') handleInlineCancel();
              }}
              // Clinical Input Styling
              className="flex-1 w-full min-w-[200px] sm:max-w-md h-[42px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-shadow hover:border-slate-900 focus:border-2 focus:border-slate-900 focus:ring-[3px] focus:ring-slate-900/10"
            />
          ) : (
            <span className={`text-sm ${!formValues[fieldKey] ? 'text-slate-400 italic' : 'text-slate-900 font-medium truncate'}`}>
              {formValues[fieldKey] || 'Not set'}
            </span>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {editable && (
              isEditing ? (
                <>
                  <button 
                    onClick={() => handleInlineSave(fieldKey)} 
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                    title="Save"
                  >
                    <Check size={16} strokeWidth={2.5} />
                  </button>
                  <button 
                    onClick={handleInlineCancel} 
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    title="Cancel"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => handleEditClick(fieldKey)} 
                  className="flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  title="Edit"
                >
                  <Pencil size={16} strokeWidth={2} />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="w-full max-w-4xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Configuration</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your personal information and contact details.</p>
            </div>
          </div>
        </div>

        {/* ── Main Form Card ── */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-500 mt-1">Update your basic profile details and contact information.</p>
          </div>
          
          <div className="flex flex-col">
            {renderEditableRow("Full Name", "fullName")}
            {renderEditableRow("Email Address", "email", "email", false)}
            {renderEditableRow("Phone Number", "phone", "tel")}
          </div>

          {user?.activeRole === 'CLIENT' && (
            <>
              <div className="px-6 py-4 border-y border-slate-200 bg-slate-50 mt-4">
                <h2 className="text-sm font-semibold text-slate-900">Company Information</h2>
                <p className="text-xs text-slate-500 mt-1">Update your business details.</p>
              </div>
              <div className="flex flex-col">
                {renderEditableRow("Company Name", "companyName")}
                {renderEditableRow("Industry", "industry")}
                {renderEditableRow("CEO Name", "ceoName")}
              </div>
            </>
          )}

          {errorMsg && (
            <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-t border-red-100 font-medium">
              {errorMsg}
            </div>
          )}

          {/* ── Card Footer Actions ── */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <button 
              onClick={handleExitRequest}
              className="w-full sm:w-auto px-4 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Exit Settings
            </button>

            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'save' })}
              disabled={!isDirty || editingField !== null || isSaving}
              className="w-full sm:w-auto px-6 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
            
          </div>
        </div>
      </div>

      {/* ── Clinical Confirmation Modal ── */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full min-w-[320px] sm:w-[400px] max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {modalConfig.type === 'save' ? 'Save changes?' : 'Unsaved changes'}
              </h3>
              
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {modalConfig.type === 'save' 
                  ? 'Are you sure you want to apply these changes to your account profile?' 
                  : 'You have unsaved changes in your profile settings. Would you like to save them before leaving this page?'}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button 
                  onClick={() => setModalConfig({ isOpen: false, type: null })}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors w-full sm:w-auto order-3 sm:order-1"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDiscard}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm w-full sm:w-auto order-2 sm:order-2 disabled:opacity-50"
                  disabled={isSaving}
                >
                  Discard
                </button>
                <button 
                  onClick={executeSave}
                  className="px-4 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm w-full sm:w-auto order-1 sm:order-3 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}