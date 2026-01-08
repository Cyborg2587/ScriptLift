import React from 'react';
import { User } from '../types';
import { LogOut, FileText, LayoutDashboard } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentView: 'dashboard' | 'shared_preview';
  onChangeView: (view: 'dashboard') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, onChangeView }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => user && onChangeView('dashboard')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight">ScriptLift</span>
            </div>

            {user && (
              <nav className="hidden md:flex space-x-1">
                <button
                  onClick={() => onChangeView('dashboard')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${currentView === 'dashboard' 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                  <span className="text-xs text-slate-500">{user.email}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors bg-slate-50 hover:bg-red-50 px-3 py-2 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm text-slate-500 italic">Free & Open Source</span>
                <form action="https://www.paypal.com/donate" method="post" target="_top">
                  <input type="hidden" name="hosted_button_id" value="Q9N2HEP6LF96W" />
                  <input 
                    type="image" 
                    src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif" 
                    name="submit" 
                    title="PayPal - The safer, easier way to pay online!" 
                    alt="Donate with PayPal button" 
                    className="h-6"
                  />
                  <img alt="" src="https://www.paypal.com/en_US/i/scr/pixel.gif" width="1" height="1" />
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} ScriptLift. Privacy-first AI Transcription.
          </p>
          <div className="mt-2 text-xs text-slate-400">
            Powered by Gemini AI • Files processed securely
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;