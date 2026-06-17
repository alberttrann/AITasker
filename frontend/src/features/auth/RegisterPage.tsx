import { useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuthStore } from '@store/auth.store';
import { RoleSwitcher } from '@components/layout/RoleSwitcher';
import { useAuth } from '@hooks/use-auth';
import type { ActiveRole } from '@t/enums';
import { AuthBackground } from '@/components/layout/Background';

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
  phoneNumber: Yup.string()
    .matches(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number.')
    .nullable(),
});

export default function RegisterPage() {
  const activeRole = useAuthStore((s) => s.activeRole);
  const switchRole = useAuthStore((s) => s.switchRole);

  // 1. Force the active role to 'CLIENT' on mount if it's null/undefined
  useEffect(() => {
    if (activeRole !== 'CLIENT' && activeRole !== 'EXPERT') {
      switchRole('CLIENT' as ActiveRole);
    }
  }, [activeRole, switchRole]);

  // Use the hook instead of direct API calls
  const { register } = useAuth();

  // Extract a readable error message from the Axios error
  const serverError = register.isError
    ? ((register.error as any)?.response?.data?.message ?? 'Something went wrong. Please try again.')
    : null;

  // 2. Removed the "User" fallback completely. It strictly returns Expert or Client.
  const roleName = activeRole === 'EXPERT' ? 'Expert' : 'Client';

  return (
    <>
    <AuthBackground />
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-sm p-md sm:p-lg relative z-10 hover:shadow transition-shadow">
        <div className="text-center mb-sm">
          <h1 className="font-headline-md text-headline-md text-primary mb-xs">AITasker</h1>
        </div>

        <RoleSwitcher />

        <Formik
          initialValues={{ fullname: '', email: '', password: '', phoneNumber: '' ,role: '' as ActiveRole}}
          validationSchema={registerSchema}
          onSubmit={(values, {setSubmitting}) => {
            // Map Formik values to the backend payload structure
            register.mutate(values,
            {
                onSettled: () => {
                  setSubmitting(false);
                },
            });
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-sm" noValidate>

              {/* Full Name Field */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="fullName">
                  Full name
                </label>
                <Field name="fullName">
                  {({ field, meta }: any) => (
                    <input
                      {...field}
                      id="fullName"
                      type="text"
                      placeholder="Jane Doe"
                      disabled={register.isPending}
                      className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                        meta.touched && meta.error
                          ? 'border-error focus:border-error focus:ring-error'
                          : ''
                      }`}
                    />
                  )}
                </Field>
                <ErrorMessage name="fullName" component="p" className="mt-1 text-xs font-semibold text-error" />
              </div>

              {/* Email Field */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="email">
                  Email address
                </label>
                <Field name="email">
                  {({ field, meta }: any) => (
                    <input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      disabled={register.isPending}
                      className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                        meta.touched && meta.error
                          ? 'border-error focus:border-error focus:ring-error'
                          : ''
                      }`}
                    />
                  )}
                </Field>
                <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
              </div>

              {/* Password Field */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="password">
                  Password
                </label>
                <Field name="password">
                  {({ field, meta }: any) => (
                    <input
                      {...field}
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      disabled={register.isPending}
                      className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                        meta.touched && meta.error
                          ? 'border-error focus:border-error focus:ring-error'
                          : ''
                      }`}
                    />
                  )}
                </Field>
                <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
              </div>

              {/* Phone Number Field (optional) */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="phoneNumber">
                  Phone number <span className="text-on-surface-variant font-normal">(optional)</span>
                </label>
                <Field name="phoneNumber">
                  {({ field, meta }: any) => (
                    <input
                      {...field}
                      id="phoneNumber"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      disabled={register.isPending}
                      className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none disabled:opacity-50 ${
                        meta.touched && meta.error
                          ? 'border-error focus:border-error focus:ring-error'
                          : ''
                      }`}
                    />
                  )}
                </Field>
                <ErrorMessage name="phoneNumber" component="p" className="mt-1 text-xs font-semibold text-error" />
              </div>

              {/* Display Backend Errors */}
              {serverError && (
                <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={register.isPending || isSubmitting}
                className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-sm px-sm rounded transition-colors shadow-sm hover:shadow disabled:opacity-50"
              >
                {register.isPending ? 'Creating account...' : `Sign up as ${roleName}`}
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
    </>
  );
}