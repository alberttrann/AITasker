import { useAuth } from '@/hooks/use-auth';

export default function DashboardGreeting() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="relative w-full py-1 mb-8 flex flex-col items-center justify-center">
      {/* Ambient glowing background effect that bleeds seamlessly */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#059669] rounded-full blur-[100px] opacity-40 pointer-events-none" />
      
      {/* Greeting Text */}
      <h1 className="relative z-10 text-3xl sm:text-3xl font-normal text-slate-900 tracking-tight text-center font-headline">
        Welcome back, <i><span className="text-primary-dark">{firstName}</span></i>
      </h1>
    </div>
  );
}
