import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Pencil, Save, X, LogOut, Check } from 'lucide-react';

export default function ProfileSettingPage() {
  const { user } = useAuth();
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
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[24px] border-2 transition-all duration-300 ${
        isModified ? 'bg-primary-bg border-primary/50' : 'bg-cream border-primary-light/20'
      }`}>
        <div className="flex-1 mb-2 sm:mb-0">
          <p className="font-headline text-xs text-primary-dark/60 uppercase tracking-wider mb-2">{label}</p>
          
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
              className="w-full sm:w-2/3 bg-white border-2 border-primary-light/50 rounded-[16px] px-4 py-3 font-body text-primary-dark focus:outline-none focus:border-primary focus:shadow-focus min-h-[56px]"
            />
          ) : (
            <p className={`font-body text-base ${!formValues[fieldKey] ? 'text-primary-dark/50 italic' : 'text-primary-dark font-medium'}`}>
              {formValues[fieldKey] || 'Not set'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {isEditing ? (
            <>
              <button onClick={() => handleInlineSave(fieldKey)} aria-label={`Save ${label}`} className="p-3 bg-primary text-white rounded-full hover:shadow-teal-glow transition-all hover:brightness-110 active:scale-95" title="Confirm">
                <Check size={18} strokeWidth={3} />
              </button>
              <button onClick={handleInlineCancel} aria-label={`Cancel editing ${label}`} className="p-3 bg-surface-card border-2 border-primary-light/30 text-primary-dark rounded-full hover:bg-primary-bg transition-all active:scale-95" title="Cancel">
                <X size={18} strokeWidth={3} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleEditClick(fieldKey)} 
              aria-label={`Edit ${label}`}
              className="p-3 text-primary-dark/60 hover:text-primary hover:bg-primary-bg rounded-full transition-all active:scale-95"
              title="Edit"
            >
              <Pencil size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8 relative">
      
      {/* ── Page Header ── */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="font-headline text-h2 font-extrabold text-primary-dark">Account Settings</h1>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* ── Left Column (3/4 Width): Form Fields ── */}
        <div className="md:col-span-3">
          <div className="bg-surface-card border-2 border-primary-light/30 rounded-[32px] p-6 md:p-8 shadow-card flex flex-col gap-6">
            <h2 className="text-h3 font-headline font-extrabold text-primary-dark mb-2">Personal Information</h2>
            
            <EditableRow label="Full Name" fieldKey="fullName" />
            <EditableRow label="Email Address" fieldKey="email" type="email" />
            <EditableRow label="Phone Number" fieldKey="phone" type="tel" />
            
          </div>
        </div>

        {/* ── Right Column (1/4 Width): Actions ── */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="bg-surface-card border-2 border-primary-light/30 rounded-[32px] p-5 shadow-card flex flex-col gap-3">
            
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'save' })}
              disabled={!isDirty}
              className={`flex items-center justify-center gap-3 w-full p-4 rounded-full font-headline font-bold transition-all duration-300 min-h-[72px] ${
                isDirty 
                  ? 'bg-gradient-to-r from-accent to-accent-light text-primary-dark hover:brightness-110 shadow-accent-glow active:scale-95' 
                  : 'bg-primary-bg text-primary-dark/40 cursor-not-allowed border-2 border-primary-light/20'
              }`}
            >
              <Save size={20} strokeWidth={2.5} />
              Save Changes
            </button>
            
            <div className="h-px w-full bg-primary-light/30 my-2 border-b border-dashed" />

            <button 
              onClick={handleExitRequest}
              className="flex items-center justify-center gap-3 w-full p-4 rounded-full hover:bg-coral-light/20 text-primary-dark font-headline font-bold transition-colors group min-h-[56px] active:scale-95 border-2 border-transparent hover:border-coral/30"
            >
              <LogOut size={20} strokeWidth={2.5} className="text-primary-dark/60 group-hover:text-coral transition-colors" />
              <span className="group-hover:text-coral transition-colors">Exit Settings</span>
            </button>

          </div>
        </div>

      </div>

      {/* ── Confirmation Modal Overlay ── */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-dark/80 backdrop-blur-md p-4 transition-all duration-300">
          <div className="w-full max-w-[448px] bg-surface-card rounded-[32px] border-4 border-primary-light/30 shadow-lg p-8 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
            
            {/* Decorative circles */}
            <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-accent-light/30 rounded-full blur-2xl z-0"></div>
            
            <div className="relative z-10">
              <h3 className="text-h3 font-headline font-extrabold text-primary-dark mb-4">
                {modalConfig.type === 'save' ? 'Save user profile?' : 'Save changes before exit?'}
              </h3>
              
              <p className="font-body text-base text-primary-dark/80 mb-8 bg-primary-bg p-4 rounded-[16px] border border-primary-light/20">
                {modalConfig.type === 'save' 
                  ? 'You are about to update your personal information. Are you sure you want to apply these changes to your account?' 
                  : 'You have unsaved changes in your profile settings. Would you like to save them before leaving this page?'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button 
                  onClick={() => setModalConfig({ isOpen: false, type: null })}
                  className="px-6 py-3 font-headline font-bold text-primary-dark hover:bg-primary-bg rounded-full transition-colors active:scale-95 border-2 border-primary-light/30 sm:w-auto w-full order-3 sm:order-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDiscard}
                  className="px-6 py-3 font-headline font-bold text-coral bg-cream border-2 border-coral shadow-sm hover:shadow-coral-glow hover:bg-coral hover:text-white rounded-full transition-all active:scale-95 sm:w-auto w-full order-2 sm:order-2"
                >
                  Discard
                </button>
                <button 
                  onClick={executeSave}
                  className="px-6 py-3 font-headline font-extrabold text-white bg-primary hover:brightness-110 shadow-teal-glow rounded-full transition-all active:scale-95 sm:w-auto w-full order-1 sm:order-3"
                >
                  Save
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}