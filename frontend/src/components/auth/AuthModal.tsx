import { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@hooks/use-auth';
import { useAuthStore } from '@store/auth.store';
import { RegisterRoleSwitcher } from '@components/layout/RoleSwitcher';
import type { UserRoleItem } from '@t/enums';

// ── Validation Schemas ───────────────────────────────────────────────────────
const loginSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(5, 'Password must be at least 5 characters.')
    .required('Password is required.'),
});

const registerSchema = Yup.object({
  fullName: Yup.string()
    .min(2, 'Full name must be at least 2 characters.')
    .required('Full name is required.'),
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters.')
    .required('Password is required.'),
  phone: Yup.string()
    .matches(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number.')
    .nullable(),
});

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'success'>(initialMode);

  const { login, register } = useAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">

      <div className="relative w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <h1 className="font-headline-md text-headline-md text-primary mb-2">AITasker</h1>
          <p className="text-sm text-on-surface-variant">
            {mode === 'signin' && 'Welcome back! Please sign in.'}
            {mode === 'signup' && 'Create your account to get started.'}
            {mode === 'success' && 'Registration complete.'}
          </p>
        </div>

        {/* ── Sign In Form ── */}
        {mode === 'signin' && (
          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={loginSchema}
            onSubmit={(values, { setSubmitting }) => {
              login.mutate(values, {
                onSettled: () => setSubmitting(false),
                onSuccess: () => onClose(),
              });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4" noValidate>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="email">
                    Email address
                  </label>
                  <Field name="email">
                    {({ field, meta }: any) => (
                      <input
                        {...field}
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        disabled={login.isPending}
                        onFocus={() => login.isError && login.reset()}
                        className={`w-full bg-surface border border-outline-variant rounded py-2 px-3 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                          meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                        }`}
                      />
                    )}
                  </Field>
                  <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="password">
                    Password
                  </label>
                  <Field name="password">
                    {({ field, meta }: any) => (
                      <div className="relative">
                        <input
                          {...field}
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={login.isPending}
                          onFocus={() => login.isError && login.reset()}
                          className={`w-full bg-surface border border-outline-variant rounded py-2 pl-3 pr-10 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                            meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                        >
                          {showPassword ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </Field>
                  <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input id="remember-me" type="checkbox" className="h-4 w-4 text-primary-container focus:ring-primary-container border-outline-variant rounded bg-surface" />
                    <label className="ml-2 block font-label-sm text-label-sm text-on-surface-variant" htmlFor="remember-me">Remember me</label>
                  </div>
                  <a href="#" className="font-label-sm text-label-sm text-primary-container hover:text-primary transition-colors">Forgot Password?</a>
                </div>

                {loginError && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center text-red-600">{loginError}</div>}

                <button
                  type="submit"
                  disabled={login.isPending || isSubmitting}
                  className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded transition-colors shadow-sm hover:shadow disabled:opacity-50"
                >
                  {login.isPending ? 'Signing in...' : 'Sign in'}
                </button>
              </Form>
            )}
          </Formik>
        )}

        {/* ── Sign Up Form ── */}
        {mode === 'signup' && (
          <div className="space-y-4">
            <Formik
              initialValues={{ fullName: '', email: '', password: '', phone: undefined, role: 'CLIENT_CEO' as UserRoleItem }}
              validationSchema={registerSchema}
              onSubmit={(values, { setSubmitting }) => {
                const { role, ...rest } = values;
                register.mutate({ ...rest, roles: role }, {
                  onSettled: () => setSubmitting(false),
                  onSuccess: () => setMode('success'),
                });
              }}
            >
              {({ isSubmitting, values, setFieldValue }) => (
                <Form className="space-y-4" noValidate>
                  <RegisterRoleSwitcher
                    value={values.role}
                    onChange={(role) => setFieldValue('role', role)}
                  />

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="fullName">Full name</label>
                    <Field name="fullName">
                      {({ field, meta }: any) => (
                        <input
                          {...field}
                          id="fullname"
                          type="text"
                          placeholder="Jane Doe"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          className={`w-full bg-surface border border-outline-variant rounded py-2 px-3 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                            meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                          }`}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="fullName" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="email">Email address</label>
                    <Field name="email">
                      {({ field, meta }: any) => (
                        <input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          className={`w-full bg-surface border border-outline-variant rounded py-2 px-3 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                            meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                          }`}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="password">Password</label>
                    <Field name="password">
                      {({ field, meta }: any) => (
                        <div className="relative">
                          <input
                            {...field}
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={register.isPending}
                            onFocus={() => register.isError && register.reset()}
                            className={`w-full bg-surface border border-outline-variant rounded py-2 pl-3 pr-10 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                              meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                          >
                            {showPassword ? (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>
                        </div>
                      )}
                    </Field>
                    <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="phone">
                      Phone number <span className="text-on-surface-variant font-normal">(optional)</span>
                    </label>
                    <Field name="phone">
                      {({ field, meta }: any) => (
                        <input
                          {...field}
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          className={`w-full bg-surface border border-outline-variant rounded py-2 px-3 font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                            meta.touched && meta.error ? 'border-error focus:border-error focus:ring-error' : ''
                          }`}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="phone" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  {registerError && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center text-red-600">{registerError}</div>}

                  <button
                    type="submit"
                    disabled={register.isPending || isSubmitting}
                    className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded transition-colors shadow-sm hover:shadow disabled:opacity-50"
                  >
                    {register.isPending ? 'Creating account...' : `Sign up as ${values.role === 'EXPERT' ? 'Expert' : 'Client'}`}
                  </button>
                </Form>
              )}
            </Formik>
          </div>
        )}

        {/* 4. Success Screen View */}
        {mode === 'success' && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-container text-on-primary-container mb-4 shadow-sm">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface mb-2">Account Created Successfully!</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                You can now log in using the credentials you just provided to access your account.
              </p>
            </div>

            <button
              onClick={() => setMode('signin')}
              className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-3 px-4 rounded transition-colors shadow-sm hover:shadow"
            >
              Go to Sign in
            </button>
          </div>
        )}

        {/* ── Shared Social / Footer ── */}
        {mode !== 'success' && (
          <>
            <div className="mt-6 relative">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-surface font-label-sm text-label-sm text-on-surface-variant">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              className="mt-6 flex items-center justify-center w-full bg-surface border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded hover:bg-surface-container-low transition-colors shadow-sm"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Google
            </button>

            {/* Mode Toggler */}
            <p className="mt-6 text-center font-label-md text-label-md text-on-surface-variant">
              {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-bold text-primary hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}