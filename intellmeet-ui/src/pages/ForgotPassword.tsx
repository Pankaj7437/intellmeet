import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/forgotpassword`, { email });
      setMessage(res.data.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-600/10 blur-3xl rounded-full"></div>
        
        <div className="relative z-10 flex flex-col items-center mb-6">
           <div className="bg-slate-900 border border-slate-700 p-4 rounded-full mb-4 shadow-lg">
              <KeyRound className="text-blue-500" size={32} />
           </div>
           <h2 className="text-2xl font-bold text-white text-center">Forgot Password?</h2>
           <p className="text-slate-400 text-sm text-center mt-2 max-w-xs">No worries, we'll send you reset instructions.</p>
        </div>

        {error && <div className="relative z-10 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center font-medium">{error}</div>}
        
        {message ? (
          <div className="relative z-10 text-center space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl text-sm font-medium">
              {message}
            </div>
            <Link to="/" className="inline-flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors mt-4 text-sm font-medium">
              <ArrowLeft size={16} /> Back to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
                  required
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
            </button>
            <div className="text-center pt-4">
              <Link to="/" className="inline-flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
                <ArrowLeft size={16} /> Back to log in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}