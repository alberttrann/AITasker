 import { Button } from "@components/ui/button"
 import { useAuthStore } from "@/store/auth.store";
 export function Dashboard(){
      const { isAuthenticated, user, activeRole, logout } = useAuthStore();
    
    return (
        <>
                    <div className="w-full max-w-[448px] bg-surface rounded-xl border border-outline-variant shadow-sm p-[32px] sm:p-[48px] relative z-10 text-center">
                    <h1 className="mb-4 text-3xl font-semibold text-primary">Dashboard</h1>
                    <p className="mb-2 text-sm text-on-surface">
                        Welcome back, <span className="font-medium text-primary">{user?.name}</span> ({user?.email})
                    </p>
                    <p className="mb-8 mt-4 inline-flex items-center rounded-lg bg-surface-container-low px-4 py-2 text-xs font-medium text-on-surface-variant">
                        Active Role: {activeRole}
                    </p>
                    <div>
                        <Button onClick={logout} className="w-full bg-primary-container text-on-primary hover:bg-primary py-sm rounded text-label-md font-label-md shadow-sm">
                        Log Out
                        </Button>
                    </div>
                    </div>
               
        </>
    )
}