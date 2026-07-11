import { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@hooks/use-auth';
import { RegisterRoleSwitcher } from '@components/layout/RoleSwitcher';
import { Button } from '@components/ui/Button';
import { Input, Label } from '@components/ui/Input';
import { Checkbox } from '@components/ui/Checkbox';
import type { UserRoleItem } from '@t/enums';
import { CheckCircle2, XCircle, Loader2, Target, Settings, Search, Eye, EyeOff, X } from 'lucide-react';

const passwordRules = [
  { id: 'min', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

// ── Validation Schemas ───────────────────────────────────────────────────────
const loginSchema = Yup.object({
  email: Yup.string()
    .trim()
    .max(254, "Email is too long")
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Enter a valid email address"
    )
    .required("Email is required"),
  password: Yup.string()
    .min(5, 'Password must be at least 5 characters.')
    .required('Password is required.'),
});

const registerSchema = Yup.object({
  fullName: Yup.string()
    .min(2, 'Full name must be at least 2 characters.')
    .required('Full name is required.'),
  email: Yup.string()
    .trim()
    .max(254, "Email is too long")
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Enter a valid email address"
    )
    .required("Email is required"),
  password: Yup.string()
    .required('Password is required.')
    .test('strong-password', 'Please satisfy all password rules.', value => {
      return passwordRules.every(r => r.test(value || ''));
    }),
  phone: Yup.string()
    .matches(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number.')
    .nullable(),
});

const forgotPasswordSchema = Yup.object({
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
});

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgotPassword';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgotPassword'>(initialMode);
  
  const { login, register, forgotPassword, isAuthenticated } = useAuth();

  const rememberedEmail = typeof window !== 'undefined' ? localStorage.getItem('aitasker-remembered-email') || '' : '';

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  // Auto-close upon successful authentication
  useEffect(() => {
    if (isAuthenticated && isOpen) onClose();
  }, [isAuthenticated, isOpen, onClose]);

  if (!isOpen) return null;

  const loginError = login.isError
    ? ((login.error as any)?.response?.data?.message ?? 'Invalid email or password.')
    : null;

  const registerError = register.isError
    ? ((register.error as any)?.response?.data?.message ?? 'Something went wrong. Please try again.')
    : null;

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

      <div className="relative w-full max-w-[448px] bg-surface rounded-xl border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col precision-line-top">

        {/* Form Area */}
        <div className="w-full p-6 sm:p-10 overflow-y-auto relative">

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors z-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-8 md:mt-2 text-center md:text-left">
            <h2 className="font-headline text-3xl font-bold text-primary mb-2">
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgotPassword' && 'Reset Password'}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {mode === 'signin' && 'Please enter your details below.'}
              {mode === 'signup' && 'Get started by filling out the form below.'}
              {mode === 'forgotPassword' && 'Enter your email to receive a password reset link.'}
            </p>
          </div>

        {/* ── Sign In Form ── */}
        {mode === 'signin' && (
          <Formik
            initialValues={{ email: rememberedEmail, password: '', rememberMe: !!rememberedEmail }}
            validationSchema={loginSchema}
            onSubmit={(values, { setSubmitting }) => {
              if (values.rememberMe) {
                localStorage.setItem('aitasker-remembered-email', values.email);
              } else {
                localStorage.removeItem('aitasker-remembered-email');
              }
              
              login.mutate({ email: values.email, password: values.password }, {
                onSettled: () => setSubmitting(false),
                onSuccess: () => onClose(),
              });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Field name="email">
                    {({ field, meta, form }: any) => (
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        disabled={login.isPending}
                        onFocus={() => {
                          if (login.isError) login.reset();
                          form.setFieldTouched(field.name, false);
                        }}
                        error={meta.touched && !!meta.error}
                      />
                    )}
                  </Field>
                  <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Field name="password">
                    {({ field, meta, form }: any) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={login.isPending}
                          onFocus={() => {
                            if (login.isError) login.reset();
                            form.setFieldTouched(field.name, false);
                          }}
                          error={meta.touched && !!meta.error}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </Field>
                  <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Field name="rememberMe" type="checkbox">
                      {({ field }: any) => (
                        <Checkbox id="remember-me" {...field} />
                      )}
                    </Field>
                    <Label className="ml-2 mb-0" htmlFor="remember-me">Remember me</Label>
                  </div>
                  <button type="button" onClick={() => setMode('forgotPassword')} className="font-label-sm text-label-sm text-primary-container hover:text-primary transition-colors">Forgot Password?</button>
                </div>

                {renderApiError(loginError)}

                <Button
                  type="submit"
                  disabled={login.isPending || isSubmitting}
                  className="w-full py-3 px-4 rounded-lg shadow-sm hover:shadow-md mt-2"
                >
                  {login.isPending ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form>
            )}
          </Formik>
        )}

        {/* ── Sign Up Form ── */}
        {mode === 'signup' && (
          <div className="space-y-4">
            <Formik
              initialValues={{ fullName: '', email: '', password: '', phone: undefined, selfTechnical: false, role: 'CLIENT_CEO' as UserRoleItem }}
              validationSchema={registerSchema}
              onSubmit={(values, { setSubmitting }) => {
                const { role, ...rest } = values;
                register.mutate({ ...rest, roles: role }, {
                  onSettled: () => setSubmitting(false),
                  onSuccess: () => onClose(),
                });
              }}
            >
              {({ isSubmitting, values, setFieldValue }) => (
                <Form className="space-y-4" noValidate>
                  <RegisterRoleSwitcher
                    value={values.role}
                    onChange={(role) => setFieldValue('role', role)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full name</Label>
                    <Field name="fullName">
                      {({ field, meta, form }: any) => (
                        <Input
                          {...field}
                          id="fullname"
                          type="text"
                          placeholder="Jane Doe"
                          disabled={register.isPending}
                          onFocus={() => {
                            if (register.isError) register.reset();
                            form.setFieldTouched(field.name, false);
                          }}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="fullName" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Field name="email">
                      {({ field, meta, form }: any) => (
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          disabled={register.isPending}
                          onFocus={() => {
                            if (register.isError) register.reset();
                            form.setFieldTouched(field.name, false);
                          }}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Field name="password">
                      {({ field, meta, form }: any) => (
                        <>
                          <div className="relative">
                            <Input
                              {...field}
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              disabled={register.isPending}
                              onFocus={() => {
                                if (register.isError) register.reset();
                                form.setFieldTouched(field.name, false);
                              }}
                              error={meta.touched && !!meta.error}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
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
                                    <span className="font-medium">
                                      {rule.label}
                                    </span>
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
                    <Label htmlFor="phone">
                      Phone number <span className="text-on-surface-variant font-normal">(optional)</span>
                    </Label>
                    <Field name="phone">
                      {({ field, meta, form }: any) => (
                        <Input
                          {...field}
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          disabled={register.isPending}
                          onFocus={() => {
                            if (register.isError) register.reset();
                            form.setFieldTouched(field.name, false);
                          }}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="phone" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  {values.role === 'CLIENT_CEO' && (
                    <div className="md:col-span-2 flex items-center gap-2 mt-2">
                      <Field name="selfTechnical" type="checkbox">
                        {({ field }: any) => (
                          <Checkbox id="selfTechnical" {...field} />
                        )}
                      </Field>
                      <Label className="mb-0" htmlFor="selfTechnical">I have technical expertise</Label>
                    </div>
                  )}
                  </div>

                  {renderApiError(registerError)}

                  <Button
                    type="submit"
                    disabled={register.isPending || isSubmitting}
                    className="w-full py-3 px-4 rounded-lg shadow-sm hover:shadow-md mt-2"
                  >
                    {register.isPending ? 'Creating account...' : (
                      <span className="flex items-center justify-center">
                        Sign up as <span className={`font-extrabold ml-1.5 uppercase tracking-wide ${values.role === 'EXPERT' ? 'text-emerald-300' : 'text-blue-300'}`}>{values.role === 'EXPERT' ? 'Expert' : 'Client'}</span>
                      </span>
                    )}
                  </Button>
                </Form>
              )}
            </Formik>
          </div>
        )}

        {/* ── Forgot Password Form ── */}
        {mode === 'forgotPassword' && (
          <Formik
            initialValues={{ email: rememberedEmail }}
            validationSchema={forgotPasswordSchema}
            onSubmit={(values, { setSubmitting, setStatus }) => {
              forgotPassword.mutate({ email: values.email }, {
                onSettled: () => setSubmitting(false),
                onSuccess: () => {
                  setStatus({ success: 'Reset link sent to your email.' });
                },
                onError: (error: any) => {
                  setStatus({ error: error.response?.data?.message || 'Something went wrong.' });
                }
              });
            }}
          >
            {({ isSubmitting, status }) => (
              <Form className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="forgot-email">Email address</Label>
                  <Field name="email">
                    {({ field, meta }: any) => (
                      <Input
                        {...field}
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        disabled={forgotPassword.isPending}
                        error={meta.touched && !!meta.error}
                      />
                    )}
                  </Field>
                  <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                {status?.success && <div className="bg-emerald-50 text-emerald-700 font-label-sm text-sm p-3 rounded-md text-center">{status.success}</div>}
                {status?.error && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-3 rounded-md text-center text-red-600">{status.error}</div>}

                <Button
                  type="submit"
                  disabled={forgotPassword.isPending || isSubmitting}
                  className="w-full py-3 px-4 rounded-lg shadow-sm hover:shadow-md mt-2"
                >
                  {forgotPassword.isPending ? 'Sending link...' : 'Send Reset Link'}
                </Button>
              </Form>
            )}
          </Formik>
        )}

        {/* ── Shared Social / Footer ── */}
            {/* Mode Toggler */}
            <p className="mt-6 text-center font-label-md text-label-md text-on-surface-variant">
              {mode === 'signin' || mode === 'forgotPassword' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' || mode === 'forgotPassword' ? 'signup' : 'signin')}
                className="font-bold text-primary hover:underline"
              >
                {mode === 'signin' || mode === 'forgotPassword' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
        </div>
      </div>
    </div>
  );
}