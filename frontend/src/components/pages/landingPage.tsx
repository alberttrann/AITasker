import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import AuthModal from "@/components/auth/AuthModal";
import { Search, Target, FileText, MessageSquare, TrendingUp, Settings, CheckCircle2, Shield, Zap, ArrowRight } from "lucide-react";

const ARCHETYPES = [
  { code: '1', label: 'AI Search & Q&A', icon: Search, color: 'text-blue-500', bg: 'bg-blue-50' },
  { code: '2', label: 'Personalisation & Recs', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { code: '3', label: 'Classification & Docs', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50' },
  { code: '4', label: 'Conversational Agent', icon: MessageSquare, color: 'text-rose-500', bg: 'bg-rose-50' },
  { code: '5', label: 'Predictive Analytics', icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50' },
  { code: '6', label: 'AI Process Automation', icon: Settings, color: 'text-cyan-500', bg: 'bg-cyan-50' },
];

const FEATURES = [
  {
    title: 'Rigorous Matching Engine',
    desc: 'Our platform matches you with experts evaluated across 6 capability domains and 10 technical seams. We guarantee quality over quantity.',
    icon: Shield,
  },
  {
    title: 'Escrow Payments',
    desc: 'Your funds are securely locked in milestone-based escrow. Release payments only when the technical deliverables are approved.',
    icon: CheckCircle2,
  },
  {
    title: 'Zero Manual Chokepoints',
    desc: 'Fully automated workflows from technical elicitation to tech-team handoffs and final deployment. Move at the speed of AI.',
    icon: Zap,
  },
];

export default function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const handleCtaClick = () => {
    if (isAuthenticated && user) {
      const role = user.activeRole;
      const subtype = user.clientSubtype;
      
      if (role === 'ADMIN') navigate('/admin');
      else if (role === 'EXPERT') navigate('/expert');
      else if (subtype === 'CEO') navigate('/ceo');
      else if (subtype === 'TECH_TEAM') navigate('/tech-team');
      else navigate('/');
    } else {
      setAuthMode('signup');
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-body">
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative bg-primary text-surface overflow-hidden min-h-screen py-12 lg:py-16 flex flex-col justify-center flex-grow">
          {/* Dot Grid Background */}
          <div 
            className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          ></div>

          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-8">
              <h1 className="text-6xl md:text-6xl lg:text-7xl font-headline font-bold leading-tight tracking-tight text-white">
                Find the right freelance <br />
                <span className="text-accent">AI expert</span>, right away.
              </h1>
              <p className="text-lg md:text-xl text-slate-300 max-w-6xl mx-auto md:mx-0 leading-relaxed">
                Connect with highly-vetted AI engineers capable of building end-to-end LLM applications, predictive models, and sophisticated RAG pipelines.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-4">
                <button
                  onClick={handleCtaClick}
                  className="bg-accent hover:bg-accent-light text-primary-dark font-headline font-bold text-lg px-8 py-4 rounded-lg shadow-accent-glow transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2"
                >
                  {isAuthenticated ? 'Back to Dashboard' : "Let's start"} <ArrowRight className="w-5 h-5" />
                </button>
                {!isAuthenticated && (
                  <button 
                    onClick={() => { setAuthMode('signin'); setIsAuthModalOpen(true); }}
                    className="text-white hover:text-accent font-headline font-semibold px-6 py-4 transition-colors"
                  >
                    Already has an account?
                  </button>
                )}
              </div>
            </div>
            
            {/* Right side colorful abstract graphic */}
            <div className="hidden lg:block flex-1 relative min-h-[500px] mt-16">
              {/* Glowing background blobs */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-accent/30 rounded-full blur-[80px] animate-pulse"></div>
              <div className="absolute top-[20%] right-[10%] w-56 h-56 bg-purple-500/30 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-[20%] left-[10%] w-64 h-64 bg-blue-500/30 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '2s' }}></div>

              <div className="relative w-full h-full">
                {/* Main Match Card */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-surface/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl transform hover:scale-105 transition-transform duration-500 z-20">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent to-emerald-400 p-[2px] shadow-accent-glow">
                      <div className="w-full h-full bg-primary-dark rounded-2xl flex items-center justify-center">
                        <Target className="w-7 h-7 text-accent" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-white font-headline text-lg font-bold">Expert Matched</h4>
                      <p className="text-accent text-sm font-mono mt-0.5">98% Capability Fit</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
                        <span>Domain Knowledge</span>
                        <span className="text-white">A+</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-accent w-full rounded-full"></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
                        <span>Technical Seams</span>
                        <span className="text-white">Matched</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-400 w-11/12 rounded-full"></div></div>
                    </div>
                  </div>
                </div>

                {/* Floating Tech Pill 1 */}
                <div className="absolute top-[20%] left-[5%] bg-surface/10 backdrop-blur-md border border-white/10 rounded-full px-5 py-3.5 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transform -rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-300 z-10 cursor-default">
                   <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                     <Settings className="w-4 h-4 text-purple-400" />
                   </div>
                   <span className="text-white text-sm font-headline font-bold">Model Fine-Tuning</span>
                </div>

                {/* Floating Tech Pill 2 */}
                <div className="absolute bottom-[25%] right-[0%] bg-surface/10 backdrop-blur-md border border-white/10 rounded-full px-5 py-3.5 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transform rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 z-30 cursor-default">
                   <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                     <Search className="w-4 h-4 text-blue-400" />
                   </div>
                   <span className="text-white text-sm font-headline font-bold">RAG Pipelines</span>
                </div>
                
                {/* Floating Code/Data Snippet */}
                <div className="absolute top-[65%] left-[0%] w-56 bg-primary-dark/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-[0_16px_32px_rgba(0,0,0,0.3)] transform -rotate-3 hover:rotate-0 hover:translate-y-[-5px] transition-all duration-500 z-10">
                  <div className="flex gap-1.5 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 w-3/4 bg-slate-600 rounded-full"></div>
                    <div className="h-2 w-1/2 bg-emerald-400/80 rounded-full"></div>
                    <div className="h-2 w-5/6 bg-slate-600 rounded-full"></div>
                    <div className="h-2 w-2/3 bg-blue-400/80 rounded-full"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 w-full text-center text-slate-400/60 text-sm font-medium z-10">
            &copy; 2026 AITasker. All rights reserved.
          </div>
        </section>

      </main>

      {/* Auth Modal overlay for the landing page CTA buttons */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialMode={authMode} 
      />
    </div>
  );
}