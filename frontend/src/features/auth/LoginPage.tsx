import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuthStore } from '@store/auth.store';
import { RoleSwitcher } from '@components/layout/RoleSwitcher';
import { useAuth } from '@hooks/use-auth';

const loginSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters.')
    .required('Password is required.'),
});

export default function LoginPage() {
  const activeRole = useAuthStore((s) => s.activeRole);
  
  // Use the hook instead of direct API calls
  const { login } = useAuth();

  // Extract a readable error message from the Axios error
  const serverError = login.isError
    ? ((login.error as any)?.response?.data?.message ?? 'Invalid email or password.')
    : null;

  const roleName =
    activeRole === 'CLIENT' ? 'Client' :
    activeRole === 'EXPERT' ? 'Expert' :
    'User'; 

  return (
    <>
    <div className="w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-sm p-md sm:p-lg relative z-10 hover:shadow transition-shadow">
      <div className="text-center mb-sm">
        <h1 className="font-headline-md text-headline-md text-primary mb-xs">AITasker</h1>
      </div>

      <RoleSwitcher />

      {/* Replaced <form> with Formik's wrapper components */}
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={(values) => login.mutate(values)}
      >
        {({ isSubmitting }) => (
          <Form className="space-y-sm" noValidate>
            
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
                    disabled={login.isPending}
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
                    disabled={login.isPending}
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

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-container focus:ring-primary-container border-outline-variant rounded bg-surface"
                />
                <label className="ml-2 block font-label-sm text-label-sm text-on-surface-variant" htmlFor="remember-me">
                  Remember me
                </label>
              </div>
              <a href="#" className="font-label-sm text-label-sm text-primary-container hover:text-primary transition-colors">
                Forgot Password?
              </a>
            </div>

            {/* Display Backend Errors (Adapted to your design system) */}
            {serverError && (
              <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending || isSubmitting}
              className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-sm px-sm rounded transition-colors shadow-sm hover:shadow disabled:opacity-50"
            >
              {login.isPending ? 'Signing in...' : `Sign in as ${roleName}`}
            </button>
          </Form>
        )}
      </Formik>

      {/* The rest of your UI remains untouched */}
      <div className="mt-sm relative">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-2 bg-surface font-label-sm text-label-sm text-on-surface-variant">Or continue with</span>
        </div>
      </div>

      <div className="mt-sm grid gap-sm flex">
        <button
          type="button"
          className="flex items-center justify-center w-full bg-surface border border-outline-variant text-on-surface font-label-md text-label-md py-xs px-sm rounded hover:bg-surface-container-low transition-colors shadow-sm"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          Google
        </button>
      </div>

      <p className="mt-md text-center font-label-md text-label-md text-on-surface-variant">
        Don't have an account? <a className="font-bold text-primary hover:underline" href="/register">Sign up</a>
      </p>
    </div>
    </>
  );
}