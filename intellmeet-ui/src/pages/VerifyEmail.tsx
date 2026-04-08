import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  const hasFetched = useRef(false);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  useEffect(() => {
    
    if (hasFetched.current) return;
    hasFetched.current = true;

    const verifyToken = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/verifyemail/${token}`);
        setMessage(res.data.message);
        setStatus('success');
      } catch (err: any) {
        setMessage(err.response?.data?.message || 'Verification failed. Token may be invalid or expired.');
        setStatus('error');
      }
    };
    
    if (token) {
      verifyToken();
    }
  }, [token, API_URL]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-white">Verifying Email...</h2>
            <p className="text-slate-400 mt-2">Please wait while we secure your account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <CheckCircle2 className="text-emerald-500 mb-4" size={56} />
            <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
            <p className="text-slate-400 mt-2 mb-6">{message}</p>
            <Link to="/" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg">Login to IntellMeet</Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <XCircle className="text-red-500 mb-4" size={56} />
            <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
            <p className="text-slate-400 mt-2 mb-6">{message}</p>
            <Link to="/" className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg">Back to Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}