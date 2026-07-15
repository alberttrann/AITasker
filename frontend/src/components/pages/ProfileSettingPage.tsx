import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Pencil, X, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { useAuthStore } from '@/store/auth.store';
import apiClient from '@/lib/api-client';

export default function ProfileSettingPage() {
  const { user } = useAuth();
  const { updateProfile, verifyTaxCode } = useUser();
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
    bio: user?.activeRoleProfile?.bio || '',
  });

  const [formValues, setFormValues] = useState({ ...originalValues });
  const [editingField, setEditingField] = useState<keyof typeof formValues | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tax Code State
  const [taxStatus, setTaxStatus] = useState<{ verified: boolean; companyName: string | null; taxCodeValue: string | null; loading?: boolean; error?: boolean }>({ verified: false, companyName: null, taxCodeValue: null });
  const [taxTimeoutId, setTaxTimeoutId] = useState<any>(null);

  const handleVerifyTaxCode = async (taxCode: string) => {
    if (!taxCode || taxCode.length < 10) {
      setTaxStatus({ verified: false, companyName: null, taxCodeValue: null });
      return;
    }
    setTaxStatus((prev) => ({ ...prev, loading: true, error: false }));
    try {
      const res = await verifyTaxCode.mutateAsync(taxCode);
      if (res.verified) {
        setTaxStatus({ verified: true, companyName: res.companyName, taxCodeValue: taxCode, loading: false });
      } else {
        setTaxStatus({ verified: false, companyName: null, taxCodeValue: null, loading: false, error: true });
      }
    } catch {
      setTaxStatus({ verified: false, companyName: null, taxCodeValue: null, loading: false, error: true });
    }
  };

  // (Removed standalone tax code logic)

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
        bio: user.activeRoleProfile?.bio || '',
      };
      setOriginalValues(newVals);
      setFormValues(newVals);
    }
  }, [user]);

  // ── Handlers ──
  const handleEditClick = (field: keyof typeof formValues) => {
    setEditingField(field);
    setTempValue(originalValues[field] as string);
  };

  const handleInlineSave = async (field: keyof typeof formValues) => {
    let newValue = tempValue;

    if (newValue === originalValues[field]) {
      setEditingField(null);
      return;
    }
    
    setSavingField(field);
    setErrorMsg(null);
    try {
      if (field === 'companyName') {
        await updateProfile.mutateAsync({ companyName: newValue });
        setOriginalValues((prev) => ({ ...prev, companyName: newValue }));
        setFormValues((prev) => ({ ...prev, companyName: newValue }));
      } else if (field === 'bio') {
        await apiClient.put('/expert-profile/me', { bio: newValue });
        setOriginalValues((prev) => ({ ...prev, bio: newValue }));
        setFormValues((prev) => ({ ...prev, bio: newValue }));
      } else {
        await updateProfile.mutateAsync({ [field]: newValue });
        setOriginalValues((prev) => ({ ...prev, [field]: newValue as any }));
        setFormValues((prev) => ({ ...prev, [field]: newValue as any }));
      }
      setEditingField(null);
      setTaxStatus({ verified: false, companyName: null, taxCodeValue: null });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile.';
      setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingField(null);
    }
  };

  const handleInlineCancel = () => {
    setEditingField(null);
    setTaxStatus({ verified: false, companyName: null, taxCodeValue: null });
  };

  // ── Helper Function for Editable Rows ──
  const renderEditableRow = (label: string, fieldKey: keyof typeof formValues, type = 'text', editable = true) => {
    const isEditing = editingField === fieldKey;
    const isSavingThis = savingField === fieldKey;

    return (
      <div key={fieldKey} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-6 border-b border-slate-100 last:border-0 transition-colors duration-200 hover:bg-slate-50/30">
        
        {/* Label Area */}
        <div className="w-full sm:w-1/3 mb-2 sm:mb-0 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">{label}</span>
        </div>

        {/* Input / Value Area */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {isEditing ? (
              <div className="relative flex-1 w-full min-w-[200px] sm:max-w-md">
                {type === 'textarea' ? (
                  <textarea
                    autoFocus
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleInlineSave(fieldKey);
                      }
                      if (e.key === 'Escape') handleInlineCancel();
                    }}
                    disabled={isSavingThis}
                    className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-shadow hover:border-slate-900 focus:border-2 focus:border-slate-900 focus:ring-[3px] focus:ring-slate-900/10 disabled:opacity-50 resize-y"
                  />
                ) : (
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
                    disabled={isSavingThis}
                    className="w-full h-[42px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-shadow hover:border-slate-900 focus:border-2 focus:border-slate-900 focus:ring-[3px] focus:ring-slate-900/10 disabled:opacity-50"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-sm ${!formValues[fieldKey] ? 'text-slate-400 italic' : 'text-slate-900 font-medium truncate'}`}>
                  {formValues[fieldKey] || 'Not specified'}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {editable && (
                isEditing ? (
                  <>
                    <button 
                      onClick={() => handleInlineSave(fieldKey)} 
                      disabled={isSavingThis}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      {isSavingThis ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                    </button>
                    <button 
                      onClick={handleInlineCancel} 
                      disabled={isSavingThis}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
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
      </div>
    );
  };

  const handleTaxCodeSubmit = async () => {
    if (!taxStatus.verified || !taxStatus.companyName || !taxStatus.taxCodeValue) return;
    
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync({ companyName: taxStatus.companyName });
      setOriginalValues((prev) => ({ ...prev, companyName: taxStatus.companyName! }));
      setFormValues((prev) => ({ ...prev, companyName: taxStatus.companyName! }));
      setTaxStatus({ verified: false, companyName: null, taxCodeValue: null, loading: false, error: false });
      (document.getElementById('taxCodeInput') as HTMLInputElement).value = '';
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile.';
      setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full">
        
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
          
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-500 mt-1">Update your basic profile details and contact information.</p>
          </div>
          
          <div className="flex flex-col">
            {renderEditableRow("Full Name", "fullName")}
            {renderEditableRow("Email Address", "email", "email", false)}
            {renderEditableRow("Phone Number", "phone", "tel")}
          </div>

          {user?.activeRole === 'CLIENT' && user?.clientSubtype !== 'TECH_TEAM' && (
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

          {user?.activeRole === 'EXPERT' && (
            <>
              <div className="px-6 py-4 border-y border-slate-200 bg-slate-50 mt-4">
                <h2 className="text-sm font-semibold text-slate-900">Expert Information</h2>
                <p className="text-xs text-slate-500 mt-1">Update your professional bio and details.</p>
              </div>
              <div className="flex flex-col">
                {renderEditableRow("Professional Bio", "bio", "textarea")}
              </div>
            </>
          )}

          {user?.activeRole === 'CLIENT' && user?.clientSubtype !== 'TECH_TEAM' && (
            <>
              <div className="px-6 py-4 border-y border-slate-200 bg-slate-50 mt-4">
                <h2 className="text-sm font-semibold text-slate-900">Tax Verification</h2>
                <p className="text-xs text-slate-500 mt-1">Verify your company using tax code.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-6 border-b border-slate-100 last:border-0 transition-colors duration-200">
                <div className="w-full sm:w-1/3 mb-2 sm:mb-0 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Tax Code</span>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="relative flex-1 w-full min-w-[200px] sm:max-w-md">
                      <input
                        id="taxCodeInput"
                        type="text"
                        placeholder="Enter 10-digit tax code"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (taxTimeoutId) clearTimeout(taxTimeoutId);
                          if (val.length >= 10) {
                            const newTimeout = setTimeout(() => {
                              handleVerifyTaxCode(val);
                            }, 500);
                            setTaxTimeoutId(newTimeout);
                          } else {
                            setTaxStatus({ verified: false, companyName: null, taxCodeValue: null, loading: false, error: false });
                          }
                        }}
                        className="w-full h-[42px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-shadow hover:border-slate-900 focus:border-2 focus:border-slate-900 focus:ring-[3px] focus:ring-slate-900/10"
                      />
                      {taxStatus.loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="animate-spin text-slate-400" size={16} />
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleTaxCodeSubmit}
                      disabled={!taxStatus.verified}
                      className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-800"
                    >
                      Save
                    </button>
                  </div>
                  
                  {(taxStatus.verified || taxStatus.error) && (
                    <div className="pt-2">
                      {taxStatus.verified && taxStatus.companyName && (
                        <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                          <Check size={16} />
                          <span>Found: {taxStatus.companyName}</span>
                        </div>
                      )}
                      {taxStatus.error && (
                        <div className="flex items-center gap-1 text-sm text-red-500 font-medium">
                          <X size={16} />
                          <span>Tax code not recognized</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-t border-red-100 font-medium">
              {errorMsg}
            </div>
          )}

        </div>
    </div>
  );
}