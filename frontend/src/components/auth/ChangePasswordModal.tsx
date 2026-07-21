import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Eye, EyeOff, XCircle, X } from 'lucide-react';

const passwordRules = [
  { id: 'min', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

const changePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required.'),
  newPassword: Yup.string()
    .required('New password is required.')
    .test('strong-password', 'Please satisfy all password rules.', value => {
      return passwordRules.every(r => r.test(value || ''));
    }),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match')
    .required('Confirm password is required'),
});

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { changePassword } = useAuth();

  if (!isOpen) return null;

  const renderApiError = (err: any) => {
    if (!err) return null;
    if (Array.isArray(err)) {
      return (
        <div className="bg-red-50 text-red-600 font-label-sm text-sm p-3 rounded-md text-left shadow-sm border border-red-100 mt-2">
          <ul className="list-disc list-inside space-y-1">
            {err.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      );
    }
    return <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center text-red-600 mt-2">{err}</div>;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[448px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col precision-line-top">
        <div className="w-full p-6 sm:p-8 overflow-y-auto relative">
          
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors z-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Change Password</h2>
            <p className="text-sm text-slate-500">Update your account password.</p>
          </div>

          <Formik
            initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
            validationSchema={changePasswordSchema}
            onSubmit={(values, { setSubmitting, setStatus }) => {
              changePassword.mutate(
                { currentPassword: values.currentPassword, newPassword: values.newPassword },
                {
                  onSettled: () => setSubmitting(false),
                  onSuccess: () => {
                    // It logs you out, so no need to do anything here really.
                    onClose();
                  },
                  onError: (error: any) => {
                    setStatus({ error: error.response?.data?.message || 'Failed to change password.' });
                  }
                }
              );
            }}
          >
            {({ isSubmitting, status }) => (
              <Form className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Field name="currentPassword">
                    {({ field, meta }: any) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="currentPassword"
                          type={showCurrent ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={changePassword.isPending}
                          error={meta.touched && !!meta.error}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    )}
                  </Field>
                  <ErrorMessage name="currentPassword" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Field name="newPassword">
                    {({ field, meta }: any) => (
                      <>
                        <div className="relative">
                          <Input
                            {...field}
                            id="newPassword"
                            type={showNew ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={changePassword.isPending}
                            error={meta.touched && !!meta.error}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {((meta.touched && !!meta.error && !field.value) ? (
                          <div className="mt-1 text-xs font-semibold text-error text-red-600">{meta.error}</div>
                        ) : (
                          field.value && !!meta.error ? (
                            <div className="mt-2 grid grid-cols-1 gap-1.5 px-1">
                              {passwordRules.filter(rule => !rule.test(field.value || '')).map(rule => (
                                <div key={rule.id} className="flex items-center gap-2 text-xs text-slate-500">
                                  <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-medium">{rule.label}</span>
                                </div>
                              ))}
                            </div>
                          ) : null
                        ))}
                      </>
                    )}
                  </Field>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Field name="confirmPassword">
                    {({ field, meta }: any) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={changePassword.isPending}
                          error={meta.touched && !!meta.error}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    )}
                  </Field>
                  <ErrorMessage name="confirmPassword" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
                </div>

                {renderApiError(status?.error)}

                <Button
                  type="submit"
                  disabled={changePassword.isPending || isSubmitting}
                  className="w-full py-3 px-4 mt-2"
                >
                  {changePassword.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}
