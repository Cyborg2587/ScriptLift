import React, { useState } from 'react';
import { User } from '../types';
import { LogOut, FileText, LayoutDashboard, Heart, X, ExternalLink } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentView: 'dashboard' | 'shared_preview';
  onChangeView: (view: 'dashboard') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, onChangeView }) => {
  const [showDonateModal, setShowDonateModal] = useState(false);

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
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Free & Open Source</span>
                <button
                  onClick={() => setShowDonateModal(true)}
                  className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Heart className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>Support Us</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col relative z-0">
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

      {/* Donation Modal */}
      {showDonateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDonateModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-orange-100">
              <button 
                onClick={() => setShowDonateModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-white/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-full shadow-sm ring-4 ring-orange-100">
                   <Heart className="w-8 h-8 text-amber-500 fill-amber-500" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900">Support ScriptLift</h3>
              <p className="text-center text-slate-600 text-sm mt-2">
                Your donation helps keep this tool free and open source for everyone.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-500 text-center leading-relaxed">
                  We rely on community support to cover server costs and API fees. 
                  Even a small coffee's worth makes a difference!
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center gap-3">
                   <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Secure Payment via PayPal</span>
                   
                   {/* PayPal Form - Opens in New Tab */}
                   <form action="https://www.paypal.com/donate" method="post" target="_blank" className="w-full">
                    <input type="hidden" name="hosted_button_id" value="Q9N2HEP6LF96W" />
                    <button 
                      type="submit" 
                      className="w-full bg-[#FFC439] hover:bg-[#F4BB29] text-slate-900 font-bold py-3 px-4 rounded-xl shadow-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 group"
                    >
                      <span>Donate with PayPal</span>
                      <ExternalLink className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <img alt="" src="https://www.paypal.com/en_US/i/scr/pixel.gif" width="1" height="1" />
                  </form>
                </div>
                
                <button 
                  onClick={() => setShowDonateModal(false)}
                  className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;