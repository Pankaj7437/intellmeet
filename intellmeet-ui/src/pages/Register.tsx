import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="flex flex-col items-center mb-6">
           <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
           </div>
           <h2 className="text-3xl font-bold text-white text-center">Create Workspace</h2>
        </div>
        
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}

        {isSuccess ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-2"><CheckCircle2 size={48} className="text-emerald-500" /></div>
            <h3 className="text-xl font-bold text-white">Check Your Email</h3>
            <p className="text-slate-400 text-sm">We've sent a verification link to <br/><span className="text-white font-medium">{email}</span>. Please verify to continue.</p>
            <Link to="/" className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg mt-4">Go to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" required placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" required placeholder="name@company.com" />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="password" value={password} minLength={6} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" required placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98] mt-2 disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
            </button>
          </form>
        )}
        
        {!isSuccess && (
          <p className="mt-8 text-center text-slate-400 text-sm">
            Already have an account? <Link to="/" className="text-blue-500 font-semibold hover:text-blue-400 transition-colors">Sign in here</Link>
          </p>
        )}
      </div>
    </div>
  );
}