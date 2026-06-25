import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Pencil, Save, X, LogOut, Check } from 'lucide-react';
import { Button } from '@components/ui/Button';

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
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 px-6 border-b border-slate-100 last:border-0 transition-colors duration-200 ${isModified ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}>
        
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
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInlineSave(fieldKey);
                if (e.key === 'Escape') handleInlineCancel();
              }}
              // Clinical Input Styling
              className="w-full sm:max-w-md h-[42px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-shadow hover:border-slate-900 focus:border-2 focus:border-slate-900 focus:ring-[3px] focus:ring-slate-900/10"
            />
          ) : (
            <span className={`text-sm ${!formValues[fieldKey] ? 'text-slate-400 italic' : 'text-slate-900 font-medium truncate'}`}>
              {formValues[fieldKey] || 'Not set'}
            </span>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isEditing ? (
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
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 relative">
      
      {/* ── Page Container ── */}
      <div className="w-full max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
        </div>

        {/* ── Main Form Card ── */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-500 mt-1">Update your basic profile details and contact information.</p>
          </div>
          
          <div className="flex flex-col">
            <EditableRow label="Full Name" fieldKey="fullName" />
            <EditableRow label="Email Address" fieldKey="email" type="email" />
            <EditableRow label="Phone Number" fieldKey="phone" type="tel" />
          </div>

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
              disabled={!isDirty || editingField !== null}
              className="w-full sm:w-auto px-6 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
            >
              <Save size={16} />
              Save Changes
            </button>
            
          </div>
        </div>
      </div>

      {/* ── Clinical Confirmation Modal ── */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            
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
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDiscard}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm w-full sm:w-auto order-2 sm:order-2"
                >
                  Discard
                </button>
                <button 
                  onClick={executeSave}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm w-full sm:w-auto order-1 sm:order-3"
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