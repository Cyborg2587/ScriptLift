import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { upsertProfile } from '../services/userService';
import { Loader2, AlertCircle, ArrowLeft, Mail, Info } from 'lucide-react';

interface AuthProps {
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<React.ReactNode | null>(null);

  // Helper to get the clean current URL without hash or query params
  const getRedirectUrl = () => {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.host}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const redirectUrl = getRedirectUrl();

    try {
      if (view === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setMessage("If an account exists with this email, you will receive a password reset link shortly.");
      } else if (view === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onLogin();
      } else {
        // SIGN UP
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
            // Explicitly use the current window location to ensure the link works for this specific session/port
            emailRedirectTo: redirectUrl, 
          }
        });

        if (error) throw error;

        // If session is null, it means email confirmation is required
        if (data.user && !data.session) {
          setMessage(
            <div className="flex flex-col gap-1">
              <span>Account created! Please check your email to confirm your account.</span>
              <span className="text-xs opacity-75 mt-1">
                Note: The link in the email will redirect to <b>{redirectUrl}</b>. Ensure this app is running at that address when you click it.
              </span>
            </div>
          );
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          try {
            await upsertProfile({
              id: data.user.id,
              email: data.user.email!,
              name: name || email.split('@')[0],
            });
          } catch (profileErr) {
            console.error("Profile creation failed:", profileErr);
          }
          
          onLogin();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {view === 'login' && 'Welcome Back'}
            {view === 'signup' && 'Create an Account'}
            {view === 'reset' && 'Reset Password'}
          </h2>
          <p className="text-slate-500 text-sm">
            {view === 'login' && 'Enter your credentials to access your workspace'}
            {view === 'signup' && 'Join to sync your files across devices'}
            {view === 'reset' && 'Enter your email to receive reset instructions'}
          </p>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-start gap-2">
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{message}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name Field (Signup Only) */}
          {view === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          )}

          {/* Email Field (All Views) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>

          {/* Password Field (Login & Signup) */}
          {view !== 'reset' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                {view === 'login' && (
                  <button 
                    type="button"
                    onClick={() => setView('reset')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                {view === 'login' && 'Sign In'}
                {view === 'signup' && 'Create Account'}
                {view === 'reset' && 'Send Reset Link'}
              </>
            )}
          </button>
        </form>

        {/* View Switching */}
        <div className="mt-6 text-center space-y-2">
          {view === 'login' && (
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <button
                onClick={() => setView('signup')}
                className="text-indigo-600 font-medium hover:text-indigo-700"
              >
                Sign up
              </button>
            </p>
          )}

          {view === 'signup' && (
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <button
                onClick={() => setView('login')}
                className="text-indigo-600 font-medium hover:text-indigo-700"
              >
                Log in
              </button>
            </p>
          )}

          {view === 'reset' && (
            <button
              onClick={() => setView('login')}
              className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;