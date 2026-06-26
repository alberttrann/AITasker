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
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-body">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-primary text-surface overflow-hidden py-24 lg:py-32">
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
                <a 
                  href="#how-it-works"
                  className="text-white hover:text-accent font-headline font-semibold px-6 py-4 transition-colors"
                >
                  How it works
                </a>
              </div>
              
              <div className="pt-8 flex items-center justify-center md:justify-start gap-4 text-sm font-semibold text-slate-400">
                <span>Trusted by fast-growing startups:</span>
                <div className="flex gap-4 opacity-70 grayscale">
                  {/* Placeholder logos using text for now */}
                  <span className="font-headline font-bold text-slate-300">TechFlow</span>
                  <span className="font-headline font-bold text-slate-300">DataSync</span>
                  <span className="font-headline font-bold text-slate-300">NexusAI</span>
                </div>
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
        </section>

        {/* Archetypes Section */}
        <section className="py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary mb-4">Explore our AI capabilities</h2>
              <p className="text-lg text-secondary max-w-6xl mx-auto">From sophisticated document search to fully automated multi-agent workflows, find experts specialized in your exact domain.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {ARCHETYPES.map((arch) => (
                <div key={arch.code} className="group p-6 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer bg-white">
                  <div className={`w-14 h-14 rounded-xl ${arch.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <arch.icon className={`w-7 h-7 ${arch.color}`} />
                  </div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-2 group-hover:text-primary-dark transition-colors">{arch.label}</h3>
                  <div className="flex items-center text-primary font-medium text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Find Experts <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section id="how-it-works" className="py-24 bg-primary-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary mb-4">A whole world of freelance talent at your fingertips</h2>
              <p className="text-lg text-secondary max-w-6xl mx-auto">We've engineered a rigorous platform designed exclusively for complex AI and ML workflows.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {FEATURES.map((feat, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-primary">
                    <feat.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-3">{feat.title}</h3>
                  <p className="text-secondary leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-24 bg-surface text-center">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-4xl font-headline font-bold text-primary mb-6">Ready to scale your AI capabilities?</h2>
            <p className="text-lg text-secondary mb-10">Join thousands of companies accelerating their product roadmaps with pre-vetted AI talent.</p>
            <button
              onClick={handleCtaClick}
              className="bg-primary hover:bg-primary-dark text-white font-headline font-bold text-lg px-10 py-4 rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-1"
            >
              {isAuthenticated ? 'Back to Dashboard' : 'Get Started'}
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary-dark border-t border-slate-800 py-12 text-slate-400 font-body">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <span className="font-headline font-extrabold text-2xl text-white tracking-tight">AITasker</span>
            <p className="mt-4 text-sm text-slate-500">The premier destination for highly-vetted AI and Machine Learning experts.</p>
          </div>
          <div>
            <h4 className="font-headline font-bold text-white mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-accent transition-colors">AI Search & Q&A</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Predictive Analytics</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Data Pipeline</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-headline font-bold text-white mb-4">For Clients</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-accent transition-colors">How it works</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Trust & Safety</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-headline font-bold text-white mb-4">For Experts</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-accent transition-colors">Become an Expert</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Community</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-sm">
          <p>&copy; {new Date().getFullYear()} AITasker. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal overlay for the landing page CTA buttons */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialMode="signup" 
      />
    </div>
  );
}