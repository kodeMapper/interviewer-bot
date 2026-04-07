import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();
  
  // Conditionally hide header on Landing and Interview rooms.
  if (location.pathname === '/' || location.pathname.startsWith('/interview/')) {
    return null;
  }

  return (
    <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-50 bg-[#0e131e]/60 backdrop-blur-lg border-b border-[#424754]/15">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tighter text-white">SkillWise</span>
        <div className="h-4 w-px bg-outline-variant/30 mx-2"></div>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-outline">Assessment Engine</span>
      </div>
      <div className="flex items-center gap-6">
        <Link 
          to="/setup" 
          className={`font-mono text-sm uppercase tracking-wider transition-colors ${location.pathname === '/setup' ? 'text-primary' : 'text-outline hover:text-white'}`}
        >
          Setup
        </Link>
        {/* Placeholder for personalized dashboard link, typically you'd read username from auth state */}
        <Link 
          to="/guest/dashboard" 
          className={`font-mono text-sm uppercase tracking-wider transition-colors ${location.pathname.includes('/dashboard') ? 'text-primary' : 'text-outline hover:text-white'}`}
        >
          Dashboard
        </Link>
      </div>
    </header>
  );
}

export default Header;
