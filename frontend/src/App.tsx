import { useAuthStore } from '@store/auth.store';
import { LoginForm } from '@components/auth/LoginForm';
import { Dashboard } from '@components/layout/AppShell';

export default function App() {
  const { isAuthenticated, user, activeRole, logout } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="bg-surface-container-low min-h-screen flex flex-col font-body-md text-on-surface">
        <main className="flex-grow flex items-center justify-center p-md">
          <LoginForm />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low min-h-screen flex flex-col font-body-md text-on-surface">
      <main className="flex-grow flex items-center justify-center p-md">
        <Dashboard/>
      </main>
    </div>
  );
}
