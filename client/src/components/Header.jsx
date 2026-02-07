import { Link, useLocation } from 'react-router-dom';
import { Mic, LayoutDashboard, Home as HomeIcon } from 'lucide-react';

function Header() {
  const location = useLocation();
  
  const isActive = (path) => {
    return location.pathname === path ? 'text-primary-400' : 'text-secondary-400 hover:text-white';
  };

  return (
    <header className="glass border-b border-secondary-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-xl">
              <Mic className="w-6 h-6 text-primary-400" />
            </div>
            <span className="text-xl font-bold gradient-text">
              AI Smart Interviewer
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <Link 
              to="/" 
              className={`flex items-center gap-2 transition-colors ${isActive('/')}`}
            >
              <HomeIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            
            <Link 
              to="/dashboard" 
              className={`flex items-center gap-2 transition-colors ${isActive('/dashboard')}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
