import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { Pencil, Save, X, LogOut, Check } from 'lucide-react';

export default function ProfileSettingPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // ── State Management ──
  const [originalValues, setOriginalValues] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [formValues, setFormValues] = useState({ ...originalValues });
  const [editingField, setEditingField] = useState<keyof typeof formValues | null>(null);
  const [tempValue, setTempValue] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'save' | 'exit' | null;
  }>({ isOpen: false, type: null });

  // Update state if user data loads slightly after mount
  useEffect(() => {
    if (user) {
      const newVals = { fullName: user.fullName || '', email: user.email || '', phone: user.phone || '' };
      setOriginalValues(newVals);
      setFormValues(newVals);
    }
  }, [user]);

  // ── Handlers ──
  const isDirty = 
    originalValues.fullName !== formValues.fullName || 
    originalValues.email !== formValues.email || 
    originalValues.phone !== formValues.phone;

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
    // TODO: Implement your actual PUT request to backend here
    // await apiClient.put('/users/me', formValues);
    
    setOriginalValues({ ...formValues }); // Reset dirty state
    setModalConfig({ isOpen: false, type: null });
    
    if (modalConfig.type === 'exit') {
      navigate('/profile');
    }
  };

  const executeDiscard = () => {
    setFormValues({ ...originalValues }); // Revert all changes
    setModalConfig({ isOpen: false, type: null });
    
    if (modalConfig.type === 'exit') {
      navigate('/profile');
    }
  };

  const handleExitRequest = () => {
    if (isDirty) {
      setModalConfig({ isOpen: true, type: 'exit' });
    } else {
      navigate('/profile');
    }
  };

  // ── Helper Component for Editable Rows ──
  const EditableRow = ({ label, fieldKey, type = 'text' }: { label: string, fieldKey: keyof typeof formValues, type?: string }) => {
    const isEditing = editingField === fieldKey;
    const isModified = formValues[fieldKey] !== originalValues[fieldKey];

    return (
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${
        isModified ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-low border-outline-variant/50'
      }`}>
        <div className="flex-1 mb-2 sm:mb-0">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
          
          {isEditing ? (
            <input
              type={type}
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInlineSave(fieldKey);
                if (e.key === 'Escape') handleInlineCancel();
              }}
              className="w-full sm:w-2/3 bg-surface border border-primary rounded-md px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : (
            <p className={`text-base font-medium ${!formValues[fieldKey] && 'text-on-surface-variant italic'}`}>
              {formValues[fieldKey] || 'Not set'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isEditing ? (
            <>
              <button onClick={() => handleInlineSave(fieldKey)} className="p-2 bg-primary text-on-primary rounded-md hover:opacity-90 transition-opacity" title="Confirm">
                <Check size={16} />
              </button>
              <button onClick={handleInlineCancel} className="p-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:bg-surface-container-low transition-colors" title="Cancel">
                <X size={16} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleEditClick(fieldKey)} 
              className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 relative">
      
      {/* ── Page Header ── */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="font-headline-md text-headline-md text-primary">Account Settings</h1>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* ── Left Column (3/4 Width): Form Fields ── */}
        <div className="md:col-span-3">
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold text-on-surface mb-2">Personal Information</h2>
            
            <EditableRow label="Full Name" fieldKey="fullName" />
            <EditableRow label="Email Address" fieldKey="email" type="email" />
            <EditableRow label="Phone Number" fieldKey="phone" type="tel" />
            
          </div>
        </div>

        {/* ── Right Column (1/4 Width): Actions ── */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-sm flex flex-col gap-2">
            
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'save' })}
              disabled={!isDirty}
              className={`flex items-center gap-3 w-full p-3 rounded-lg text-left font-medium transition-all duration-200 ${
                isDirty 
                  ? 'bg-primary text-on-primary hover:opacity-90 shadow-md' 
                  : 'bg-surface-container-low text-on-surface-variant opacity-50 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              Save Changes
            </button>
            
            <div className="h-px w-full bg-outline-variant/50 my-1" />

            <button 
              onClick={handleExitRequest}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-container-low text-left text-on-surface font-medium transition-colors group"
            >
              <LogOut size={18} className="text-on-surface-variant group-hover:text-error transition-colors" />
              Exit Settings
            </button>

          </div>
        </div>

      </div>

      {/* ── Confirmation Modal Overlay ── */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
            
            <h3 className="text-xl font-bold text-on-surface mb-2">
              {modalConfig.type === 'save' ? 'Save user profile?' : 'Save changes before exit?'}
            </h3>
            
            <p className="text-sm text-on-surface-variant mb-6">
              {modalConfig.type === 'save' 
                ? 'You are about to update your personal information. Are you sure you want to apply these changes to your account?' 
                : 'You have unsaved changes in your profile settings. Would you like to save them before leaving this page?'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button 
                onClick={() => setModalConfig({ isOpen: false, type: null })}
                className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors order-3 sm:order-1"
              >
                Cancel
              </button>
              <button 
                onClick={executeDiscard}
                className="px-4 py-2 text-sm font-medium text-error bg-error/10 hover:bg-error/20 rounded-lg transition-colors order-2 sm:order-2"
              >
                Discard
              </button>
              <button 
                onClick={executeSave}
                className="px-4 py-2 text-sm font-medium text-on-primary bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm order-1 sm:order-3"
              >
                Save
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}