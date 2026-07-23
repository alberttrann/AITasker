import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@hooks/use-auth';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';
import { Eye, EyeOff, XCircle, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@components/ui/Spinner';

/**
 * ShakeInput — plays a horizontal shake animation when `error` first becomes true.
 * Resets via onAnimationEnd so it can re-fire on the next invalid attempt.
 */
type ShakeInputProps = React.ComponentProps<typeof Input>;
function ShakeInput({ error, className, ...props }: ShakeInputProps) {
  const [shaking, setShaking] = useState(false);
  const prevError = useRef(false);

  useEffect(() => {
    if (error && !prevError.current) setShaking(true);
    prevError.current = !!error;
  }, [error]);

  return (
    <Input
      {...props}
      error={error}
      shake={shaking}
      className={className}
      onAnimationEnd={() => setShaking(false)}
    />
  );
}

const passwordRules = [
  { id: 'min', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

const resetPasswordSchema = Yup.object({
  newPassword: Yup.string()
    .required('Password is required.')
    .test('strong-password', 'Please satisfy all password rules.', value => {
      return passwordRules.every(r => r.test(value || ''));
    }),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match')
    .required('Confirm password is required'),
});

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { resetPassword, verifyResetToken } = useAuth();
  
  const verifyTokenQuery = verifyResetToken(token);

  if (!token || verifyTokenQuery.isError) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-900 via-[#0F172A] to-slate-900 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>

        <div className="relative z-10 text-center p-8 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Link Expired or Invalid</h2>
          <p className="text-slate-500 mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/?action=forgot-password" className="inline-block py-2.5 px-5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm">
            Request a new one
          </Link>
          <div className="mt-6">
            <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">Return Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (verifyTokenQuery.isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-900 via-[#0F172A] to-slate-900">
         <Spinner size="lg" className="text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-900 via-[#0F172A] to-slate-900 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-slate-200 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <Formik
          initialValues={{ newPassword: '', confirmPassword: '' }}
          validationSchema={resetPasswordSchema}
          onSubmit={(values, { setSubmitting, setStatus }) => {
            resetPassword.mutate({ token, newPassword: values.newPassword }, {
              onSettled: () => setSubmitting(false),
              onSuccess: () => {
                setStatus({ success: 'Password has been successfully reset. You can now log in.' });
              },
              onError: (error: any) => {
                setStatus({ error: error.response?.data?.message || 'Failed to reset password. The link might be expired.' });
              }
            });
          }}
        >
          {({ isSubmitting, status }) => (
            status?.success ? (
              <div className="flex flex-col items-center justify-center py-6 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Password Reset Complete</h3>
                <p className="text-slate-500 mb-8 max-w-sm">
                  {status.success}
                </p>
                <Link 
                  to="/" 
                  className="w-full py-3 px-4 bg-primary text-white rounded-lg font-bold shadow-sm hover:shadow-md hover:bg-primary/90 transition-all text-center block"
                >
                  Return to Homepage
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h2 className="font-headline text-3xl font-bold text-primary mb-2">Reset Password</h2>
                  <p className="text-sm text-slate-500">Create a new secure password for your account.</p>
                </div>
                <Form className="space-y-4" noValidate>
                  <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Field name="newPassword">
                  {({ field, meta, form }: any) => (
                    <>
                      <div className="relative">
                        <ShakeInput
                          {...field}
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={resetPassword.isPending || status?.success}
                          error={meta.touched && !!meta.error}
                          className="pr-10"
                          onFocus={() => form.setFieldTouched(field.name, false)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Field name="confirmPassword">
                  {({ field, meta, form }: any) => (
                    <div className="relative">
                      <ShakeInput
                        {...field}
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        disabled={resetPassword.isPending || status?.success}
                        error={meta.touched && !!meta.error}
                        className="pr-10"
                        onFocus={() => form.setFieldTouched(field.name, false)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  )}
                </Field>
                <ErrorMessage name="confirmPassword" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
              </div>

                  {status?.error && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-3 rounded-md text-center text-red-600">{status.error}</div>}

                  <Button
                    type="submit"
                    disabled={resetPassword.isPending || isSubmitting}
                    className="w-full py-3 px-4 mt-2"
                  >
                    {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </Form>
              </>
            )
          )}
        </Formik>
      </div>
    </div>
  );
}
