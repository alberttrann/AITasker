import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, CheckCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/Spinner';
import {
  useBankLinkStatus,
  useInitiateBankLink,
  useUpdateBankLink,
} from '@/hooks/use-wallet';

const ACCOUNT_XID_PATTERN = /^[0-9]{6,19}$/;
const HOLDER_NAME_PATTERN = /^[\p{L}\s.'-]+$/u;

interface FormErrors {
  bank_account_xid?: string;
  holder_name?: string;
}

function validate(values: { bank_account_xid: string; holder_name: string }): FormErrors {
  const errors: FormErrors = {};

  if (!values.bank_account_xid.trim()) {
    errors.bank_account_xid = 'Account number is required.';
  } else if (!ACCOUNT_XID_PATTERN.test(values.bank_account_xid.trim())) {
    errors.bank_account_xid = 'Must be numeric, 6–19 digits.';
  }

  if (!values.holder_name.trim()) {
    errors.holder_name = 'Account holder name is required.';
  } else if (values.holder_name.trim().length < 2) {
    errors.holder_name = 'Must be at least 2 characters.';
  } else if (!HOLDER_NAME_PATTERN.test(values.holder_name.trim())) {
    errors.holder_name = 'Letters and spaces only.';
  }

  return errors;
}

export default function BankHubLink() {
  const navigate = useNavigate();
  const { data: linkStatus, isLoading: statusLoading } = useBankLinkStatus();
  const initiateLink = useInitiateBankLink();
  const updateLink = useUpdateBankLink();

  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState({ bank_account_xid: '', holder_name: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitSucceeded, setSubmitSucceeded] = useState(false);

  const isAlreadyLinked = !!linkStatus?.isLinked;
  const showForm = !isAlreadyLinked || isEditing;
  const activeMutation = isAlreadyLinked ? updateLink : initiateLink;

  const handleChange = (field: 'bank_account_xid' | 'holder_name', raw: string) => {
    const value = field === 'bank_account_xid' ? raw.replace(/[^0-9]/g, '') : raw;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = {
      bank_account_xid: values.bank_account_xid.trim(),
      holder_name: values.holder_name.trim(),
    };
    const validationErrors = validate(trimmed);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    activeMutation.mutate(trimmed, {
      onSuccess: () => {
        setSubmitSucceeded(true);
        setIsEditing(false);
      },
    });
  };

  const serverErrorMessage =
    (activeMutation.error as any)?.response?.data?.message ||
    (activeMutation.isError ? 'Something went wrong. Please try again.' : null);

  return (
    <div className="py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Landmark className="text-slate-500" size={24} />
          {isAlreadyLinked ? 'Bank Account' : 'Link Bank Account'}
        </h1>
      </div>

      <div className="max-w-xl mx-auto mt-8">
        {statusLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" className="text-slate-400" />
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            {/* Already-linked, read-only summary */}
            {isAlreadyLinked && !isEditing && (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle size={32} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Bank Account Linked
                </h2>
                <p className="text-slate-500 mb-1">
                  Account: <span className="font-medium text-slate-800">{linkStatus?.bankAccountXid}</span>
                </p>
                <p className="text-slate-500 mb-6">
                  Holder: <span className="font-medium text-slate-800">{linkStatus?.holderName}</span>
                </p>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setValues({
                        bank_account_xid: linkStatus?.bankAccountXid || '',
                        holder_name: linkStatus?.holderName || '',
                      });
                      setIsEditing(true);
                    }}
                  >
                    <Pencil size={14} className="mr-1.5" />
                    Edit Details
                  </Button>
                  <Button className="flex-1" onClick={() => navigate('/expert/wallet')}>
                    Back to Wallet
                  </Button>
                </div>
              </div>
            )}

            {/* Success state (fresh link or just-saved edit), before navigating away */}
            {submitSucceeded && !isEditing && !isAlreadyLinked && (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle size={32} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Bank Account Linked</h2>
                <p className="text-slate-500 mb-6">
                  You're all set to receive payouts from completed milestones.
                </p>
                <Button className="w-full" onClick={() => navigate('/expert/wallet')}>
                  Back to Wallet
                </Button>
              </div>
            )}

            {/* Form: either first-time link, or editing an existing one */}
            {showForm && (!submitSucceeded || isEditing) && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isAlreadyLinked && (
                  <p className="text-sm text-slate-500 mb-2">
                    Link the bank account you want to receive milestone payouts to. This
                    only needs to be done once — you can update it later if needed.
                  </p>
                )}

                {serverErrorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {serverErrorMessage}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Bank Account Number
                  </label>
                  <Input
                    inputMode="numeric"
                    placeholder="e.g. 0123456789"
                    value={values.bank_account_xid}
                    error={!!errors.bank_account_xid}
                    onChange={(e) => handleChange('bank_account_xid', e.target.value)}
                  />
                  {errors.bank_account_xid && (
                    <p className="mt-1.5 text-xs text-red-600">{errors.bank_account_xid}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Account Holder Name
                  </label>
                  <Input
                    placeholder="e.g. NGUYEN VAN A"
                    value={values.holder_name}
                    error={!!errors.holder_name}
                    onChange={(e) => handleChange('holder_name', e.target.value)}
                  />
                  {errors.holder_name && (
                    <p className="mt-1.5 text-xs text-red-600">{errors.holder_name}</p>
                  )}
                  <p className="mt-1.5 text-xs text-slate-400">
                    Must exactly match the name on the bank account.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  {isEditing && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setIsEditing(false);
                        setErrors({});
                      }}
                      disabled={activeMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" disabled={activeMutation.isPending}>
                    {activeMutation.isPending ? (
                      <>
                        <Spinner size="sm" className="mr-2 text-white" />
                        {isAlreadyLinked ? 'Saving...' : 'Linking...'}
                      </>
                    ) : isAlreadyLinked ? (
                      'Save Changes'
                    ) : (
                      'Link Bank Account'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
