import { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const { resettoken } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match');
    setError('');
    setIsLoading(true);

    try {
      const res = await axios.put(`${API_URL}/api/auth/resetpassword/${resettoken}`, { password });
      setMessage(res.data.message);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired token.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-600/10 blur-3xl rounded-full"></div>

        <div className="relative z-10 flex flex-col items-center mb-6">
           <div className="bg-slate-900 border border-slate-700 p-4 rounded-full mb-4 shadow-lg">
              <ShieldCheck className="text-emerald-500" size={32} />
           </div>
           <h2 className="text-2xl font-bold text-white text-center">Set New Password</h2>
           <p className="text-slate-400 text-sm text-center mt-2 max-w-xs">Your new password must be at least 6 characters.</p>
        </div>

        {error && <div className="relative z-10 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center font-medium">{error}</div>}
        
        {message ? (
          <div className="relative z-10 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl text-sm font-medium">
              {message}
            </div>
            <p className="text-slate-400 text-sm">Redirecting to login...</p>
            <Link to="/" className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all mt-2">Go to Login Now</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600" placeholder="••••••••"/>
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pl-10 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600" placeholder="••••••••"/>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 mt-4">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Save Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}