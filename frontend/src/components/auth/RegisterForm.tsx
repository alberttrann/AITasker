import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@store/auth.store';
import { RoleSwitcher } from '@components/layout/RoleSwitcher';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const login = useAuthStore((state) => state.login);
  const activeRole = useAuthStore((state) => state.activeRole);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    login(data.email);
  };

  const roleName = activeRole === 'CLIENT' ? 'Client' : 'Expert';

  return (
    <div className="w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-sm p-md sm:p-lg relative z-10 hover:shadow transition-shadow">
      <div className="text-center mb-sm">
        <h1 className="font-headline-md text-headline-md text-primary mb-xs">AITasker</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Create a new {roleName} account.
        </p>
      </div>

      <RoleSwitcher />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-sm">
        <div>
          <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="fullName">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="John Doe"
            {...register('fullName')}
            className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none ${errors.fullName ? 'border-error focus:border-error focus:ring-error' : ''}`}
          />
          {errors.fullName && (
            <p className="mt-1 text-xs font-semibold text-error">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none ${errors.email ? 'border-error focus:border-error focus:ring-error' : ''}`}
          />
          {errors.email && (
            <p className="mt-1 text-xs font-semibold text-error">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="phone">
            Phone Number (Optional)
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            {...register('phone')}
            className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none ${errors.phone ? 'border-error focus:border-error focus:ring-error' : ''}`}
          />
          {errors.phone && (
            <p className="mt-1 text-xs font-semibold text-error">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block font-label-md text-label-md text-on-surface mb-base" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={`w-full bg-surface border border-outline-variant rounded py-xs px-sm font-body-md text-body-md text-on-surface transition-shadow focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none ${errors.password ? 'border-error focus:border-error focus:ring-error' : ''}`}
          />
          {errors.password && (
            <p className="mt-1 text-xs font-semibold text-error">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-sm px-sm rounded transition-colors shadow-sm hover:shadow disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : `Sign up as ${roleName}`}
        </button>
      </form>

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
    </div>
  );
}
