import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function Landing() {
  const navigate = useNavigate();
  const [username] = useState('');

  const handleStart = (e) => {
    e.preventDefault();
    navigate('/setup');
  };

  const handleDashboard = (e) => {
    e.preventDefault();
    const targetUser = username.trim() ? username.trim() : prompt('Enter your username to open dashboard:');
    if (targetUser) {
      navigate(`/${targetUser}/dashboard`);
    }
  };

  return (
    <div className="bg-background bg-grid-pattern selection:bg-primary/30 min-h-screen relative font-body text-on-surface overflow-x-hidden">

      {/* ── TopNavBar ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl flex justify-between items-center px-8 py-3 bg-surface/60 backdrop-blur-2xl rounded-full border border-white/15 shadow-[0_0_40px_rgba(124,77,255,0.08)]">
        <div className="text-2xl font-black tracking-tighter text-on-surface font-cinzel">SkillWise</div>

        <div className="hidden md:flex items-center gap-10">
          <a className="text-primary font-medium border-b-2 border-primary/40 pb-0.5 transition-all duration-300 font-label tracking-[0.05em]" href="#">Platform</a>
          <a className="text-on-surface-variant hover:text-primary transition-all duration-300 font-label tracking-[0.05em] cursor-pointer" onClick={() => navigate('/setup')}>Assess</a>
          <a className="text-on-surface-variant hover:text-primary transition-all duration-300 font-label tracking-[0.05em] cursor-pointer" onClick={() => navigate('/admin')}>Admin</a>
        </div>

        <div className="flex items-center gap-5">
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors hidden sm:block" onClick={handleDashboard}>account_circle</span>
          <button
            onClick={handleStart}
            className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-label font-medium hover:scale-95 active:scale-90 transition-all duration-300 shadow-lg shadow-primary/20"
          >
            Get Started
          </button>
        </div>
      </nav>

      <main className="relative">

        <section className="relative min-h-screen flex items-center pt-32 pb-20 px-6 overflow-hidden" style={{ marginLeft: '150px' }}>

          {/* Ambient Light Sources */}
          <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(124, 77, 255, 0.15) 0%, rgba(14, 14, 14, 0) 70%)' }}></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(0, 218, 243, 0.08) 0%, rgba(14, 14, 14, 0) 70%)' }}></div>

          {/* Hero Text — left-aligned */}
          <div className="container max-w-7xl mx-auto relative z-10 text-left mt-[60px]">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_#00daf3]"></span>
              <span className="font-kalam text-[12px] lowercase tracking-[0.1em] text-secondary">Spatial Interview Intelligence v2.0</span>
            </div>

            {/* Headline */}
            <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-on-surface mb-8 leading-[1.1]" style={{ textShadow: '0 0 40px rgba(166, 140, 255, 0.6)' }}>
              Evaluating Talent <br />
              <span className="text-transparent bg-clip-text inline-block" style={{ background: 'linear-gradient(135deg, #a68cff 0%, #00daf3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>In Multi-Dimensions</span>
            </h1>

            {/* Subtext */}
            <p className="max-w-2xl text-lg md:text-xl text-on-surface-variant font-light mb-12 leading-relaxed">
              Move beyond static resumes. SkillWise orchestrates immersive, AI-driven technical assessments that mirror real-world complexity with absolute proctoring integrity.
            </p>

            {/* CTAs */}
            <div className="flex flex-col md:flex-row items-start gap-6 mb-20">
              <button
                onClick={handleDashboard}
                className="px-10 py-5 rounded-full font-bold text-lg text-on-primary flex items-center gap-3 hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(166,140,255,0.3)] hover:shadow-[0_0_60px_rgba(166,140,255,0.5)]"
                style={{ background: 'linear-gradient(135deg, #a68cff 0%, #00daf3 100%)' }}
              >
                Launch Dashboard
                <span className="material-symbols-outlined">north_east</span>
              </button>
              <button
                onClick={handleStart}
                className="px-10 py-5 rounded-full font-semibold text-lg text-on-surface border border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all duration-300"
              >
                Watch System Demo
              </button>
            </div>
          </div>

          {/* Floating Hero UI Panel + Human Figure — centered on screen */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-end justify-center">
            {/* The Card */}
            <motion.div 
              animate={{ y: [-8, 8, -8] }} 
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="glass-panel p-4 rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[600px] lg:w-[750px] shrink-0" 
              style={{ background: 'rgba(32, 31, 31, 0.6)', backdropFilter: 'blur(40px)', boxShadow: 'inset 0 0 20px rgba(166, 140, 255, 0.05)' }}
            >
              {/* Window Chrome */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-error/40"></div>
                  <div className="w-2 h-2 rounded-full bg-secondary/40"></div>
                  <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
              </div>
              {/* Screenshot */}
              <img
                className="w-full rounded-2xl grayscale contrast-125 opacity-50 border border-white/5"
                alt="futuristic dark holographic interface showing data visualization of candidate technical skills and behavioral metrics"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMgdr4ZvATEeshAledypAr2gkXSvUTnWHp3Q5VTwOR9fABjU6dIfTNgWWYj-SbUVpndF8vDk-VN1pgc4L3vKJg1w93EK86rpMsESNWdgtAx9FKfUY6GTsTd7oez568tWcuBO4MrdSRwcGGNnBuBc9MKR_Zexaq73NwhEyuRXGbkCBvReNTAwhdL0RCRyracdbze6ov1Ssu9_7F2vqjdJ8HCmdDHfM7QQzOzGfUfvi-wboyNTPbr2QG2Ajj1AgcfPfB1IEDbf95jOo"
              />
            </motion.div>

            {/* Human Figure — leaning against the card */}
            <motion.img
              src="/hero-figure.png"
              alt="Professional figure"
              className="h-[560px] lg:h-[650px] object-contain pointer-events-none select-none hidden md:block shrink-0 ml-[-60px] mb-[-10px]"
              style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))', mixBlendMode: 'multiply' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            />
          </div>
        </section>

        {/* ── Features Bento Section ── */}
        <section className="py-24 px-6 relative">
          <div className="container max-w-7xl mx-auto">
            <div className="mb-20 space-y-4">
              <h2 className="font-syne font-headline text-4xl md:text-5xl font-bold text-on-surface tracking-tight">The Future of Assessment</h2>
              <p className="text-on-surface-variant max-w-xl text-lg">Our core engine leverages three pillars of spatial analysis to ensure every hire is a precision match.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[260px]">

              {/* Feature 1 — AI Engine (wide) */}
              <div className="md:col-span-8 glass-panel rounded-3xl p-10 flex flex-col justify-end relative overflow-hidden group border border-white/10">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                  <span className="material-symbols-outlined text-[180px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                </div>
                <div className="relative z-10 max-w-md">
                  <span className="font-label text-xs tracking-widest text-primary mb-4 block uppercase">Cognitive Analysis</span>
                  <h3 className="text-3xl font-bold mb-4 font-syne font-headline">Dynamic Skill Evaluation</h3>
                  <p className="text-on-surface-variant font-body">Our engine orchestrates real-time technical assessments that adapt difficulty and topic depth based on live candidate performance.</p>
                </div>
              </div>

              {/* Feature 2 — Behavioral Integrity (narrow) */}
              <div className="md:col-span-4 glass-panel rounded-3xl p-10 flex flex-col justify-between border-t border-secondary/20 relative overflow-hidden group border border-white/10">
                <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/30">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3 font-syne font-headline">Behavioral Integrity</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed font-body">Real-time computer vision prevents phone usage, multi-person presence, and detects unauthorized assistance during assessment.</p>
                </div>
              </div>

              {/* Feature 3 — AI Proctoring (narrow) */}
              <div className="md:col-span-4 glass-panel rounded-3xl p-10 flex flex-col justify-between group overflow-hidden border border-white/10 relative">
                <div className="h-12 w-12 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary border border-primary/30 relative z-10">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-3 font-syne font-headline">AI-Powered Proctoring</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed font-body">Automated integrity scoring with flagged violations for eye-tracking and environmental precision monitoring.</p>
                </div>
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 blur-3xl group-hover:bg-primary/20 transition-all duration-700"></div>
              </div>

              {/* Feature 4 — Personalized Dashboard (wide) */}
              <div className="md:col-span-8 glass-panel rounded-3xl p-10 flex flex-col md:flex-row gap-8 items-center border-l border-primary/20 border border-white/10">
                <div className="flex-1 space-y-4">
                  <h3 className="text-3xl font-bold font-syne font-headline">Personalized Dashboard</h3>
                  <p className="text-on-surface-variant font-body">Track your growth with a comprehensive history of every interview attempt, complete with session labels and high-fidelity reports.</p>
                  <div className="flex gap-4 pt-4">
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-label uppercase tracking-widest text-on-surface">Data-Responsive</div>
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-label uppercase tracking-widest text-on-surface">Session Labels</div>
                  </div>
                </div>
                <div className="hidden md:block w-1/3 h-full bg-surface-container-highest rounded-2xl border border-white/5 p-4 font-mono text-xs text-secondary-dim opacity-60">
                  <div className="flex gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-error/50"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary/50"></div>
                  </div>
                  <p className="mb-1">export function optimize(talent) {'{'}</p>
                  <p className="mb-1 pl-4">return talent.filter(skill =&gt; {'{'}</p>
                  <p className="mb-1 pl-8">return skill.is_next_gen;</p>
                  <p className="mb-1 pl-4">{'}'});</p>
                  <p>{'}'}</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Stats Section ── */}
        <section className="py-32 relative overflow-visible mt-16 mb-16">
          <div className="absolute inset-x-0 top-0 bottom-0 bg-primary/5 -skew-y-3 pointer-events-none transform origin-left"></div>
          <div className="container max-w-7xl mx-auto px-6 relative z-10 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-16 gap-x-4 text-center items-center justify-center">
              <div className="space-y-3">
                <div className="text-4xl md:text-5xl lg:text-6xl font-black font-syne" style={{ textShadow: '0 0 30px rgba(166, 140, 255, 0.4)' }}>10+</div>
                <div className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Adaptive Topics</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl md:text-5xl lg:text-6xl font-black font-syne text-secondary" style={{ textShadow: '0 0 30px rgba(0, 218, 243, 0.4)' }}>&lt;0.5s</div>
                <div className="font-label text-xs uppercase tracking-widest text-on-surface-variant">System Latency</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl md:text-5xl lg:text-6xl font-black font-syne" style={{ textShadow: '0 0 30px rgba(166, 140, 255, 0.4)' }}>100%</div>
                <div className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Real-Time Tracking</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl md:text-5xl lg:text-6xl font-black font-syne text-secondary" style={{ textShadow: '0 0 30px rgba(0, 218, 243, 0.4)' }}>3</div>
                <div className="font-label text-xs uppercase tracking-widest text-on-surface-variant">AI Models Running</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="py-32 px-6">
          <div className="container max-w-5xl mx-auto">
            <div className="glass-panel rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden border border-white/10" style={{ background: 'rgba(32, 31, 31, 0.6)', backdropFilter: 'blur(40px)', boxShadow: 'inset 0 0 20px rgba(166, 140, 255, 0.05)' }}>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-headline font-extrabold mb-8">
                  Ready to evolve your <br />
                  <span className="text-primary">talent ecosystem?</span>
                </h2>
                <p className="text-on-surface-variant text-lg mb-12 max-w-2xl mx-auto">
                  Join the 500+ global enterprises using SkillWise to define the next generation of technical assessment.
                </p>
                <div className="flex flex-col md:flex-row justify-center gap-6">
                  <button
                    onClick={handleStart}
                    className="px-12 py-5 rounded-full font-bold text-on-primary shadow-2xl hover:scale-105 transition-all"
                    style={{ background: 'linear-gradient(135deg, #a68cff 0%, #00daf3 100%)' }}
                  >
                    Get Started for Free
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); alert('Enterprise Sales: coming soon.'); }}
                    className="bg-surface-bright/20 backdrop-blur-md px-12 py-5 rounded-full font-bold border border-white/10 hover:bg-white/10 transition-all text-on-surface"
                  >
                    Contact Enterprise Sales
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-20 border-t border-white/5 bg-surface-container-lowest">
          <div className="container max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
              <div className="col-span-1 md:col-span-2 space-y-6">
                <div className="text-2xl font-black tracking-tighter font-cinzel">SkillWise</div>
                <p className="text-on-surface-variant max-w-xs text-sm leading-relaxed font-body">
                  Defining the <span className="font-kalam text-primary">spatial intelligence</span> standard for modern technical hiring. Built for the era of high-precision talent.
                </p>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-sm">alternate_email</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-sm">public</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface mb-6">Platform</h4>
                <ul className="space-y-4 text-sm text-on-surface-variant">
                  <li><a className="hover:text-primary transition-colors" href="#">AI Proctoring</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">Skill Mapping</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">Talent Pool</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">API Access</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface mb-6">Support</h4>
                <ul className="space-y-4 text-sm text-on-surface-variant">
                  <li><a className="hover:text-primary transition-colors" href="#">Documentation</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">Enterprise SLA</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">Status</a></li>
                  <li><a className="hover:text-primary transition-colors" href="#">Legal</a></li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-white/5 gap-6">
              <p className="text-xs text-on-surface-variant/40 font-label tracking-widest uppercase">© 2026 SkillWise AI. All Rights Reserved.</p>
              <div className="flex gap-8">
                <a className="text-xs text-on-surface-variant/40 hover:text-primary transition-colors uppercase font-label tracking-widest" href="#">Privacy Policy</a>
                <a className="text-xs text-on-surface-variant/40 hover:text-primary transition-colors uppercase font-label tracking-widest" href="#">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}

export default Landing;
