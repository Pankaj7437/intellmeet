import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { 
  Video, Calendar, User, LogOut, Copy, Plus, 
  Users, Edit2, Lock, Loader2, X, Trash2, Clock, ShieldAlert, History, Link as LinkIcon, FileText, CheckSquare, BarChart3, Target, CheckCircle2, TrendingUp, Activity
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

import Login from './pages/Login';
import Register from './pages/Register';
import MeetingRoom from './pages/MeetingRoom';
import MeetingSummary from './pages/MeetingSummary';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import { useAuthStore } from './store/authStore';

interface TaskData {
  id: string;
  text: string;
  status: 'todo' | 'in-progress' | 'done';
}

interface MeetingData {
  _id: string;
  title: string;
  date: string;
  time: string;
  roomId: string;
  isWaitingRoom?: boolean;
  status?: string;
  summary?: string;
  tasks?: TaskData[];
}

interface UserData {
  _id?: string;
  id?: string;
  name?: string;
  firstName?: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  user: UserData | null;
  logout: () => void;
  setUser: (user: UserData) => void;
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const token = useAuthStore((state: unknown) => (state as AuthState).token);
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const generateRoomCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getStr = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${getStr(3)}-${getStr(4)}-${getStr(3)}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state: unknown) => (state as AuthState).user);
  const logout = useAuthStore((state: unknown) => (state as AuthState).logout);
  const token = useAuthStore((state: unknown) => (state as AuthState).token);
  const setUser = useAuthStore((state: unknown) => (state as AuthState).setUser);
  
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'history' | 'tasks' | 'analytics' | 'profile'>('home');
  const [joinCode, setJoinCode] = useState('');
  const [instantRoomCode] = useState(generateRoomCode());
  const [instantWaitingRoom, setInstantWaitingRoom] = useState(false);
  
  const env = (import.meta as unknown as { env: Record<string, string> }).env;
  const base_url = (env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/api\/?$/, '');
  const API_URL = `${base_url}/api`;

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [newName, setNewName] = useState(user?.name || user?.firstName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [isWaitingRoom, setIsWaitingRoom] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  const [scheduledMeetings, setScheduledMeetings] = useState<MeetingData[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if ((activeTab === 'schedule' || activeTab === 'history' || activeTab === 'tasks' || activeTab === 'analytics') && token) {
      const fetchMeetings = async () => {
        setIsLoadingMeetings(true);
        try {
          const res = await fetch(`${API_URL}/meetings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.status === 401) { logout(); return; }
          if (res.ok) {
            const data = await res.json();
            setScheduledMeetings(data);
          }
        } catch (err) {
          console.error(err);
        } finally { 
          setIsLoadingMeetings(false); 
        }
      };
      fetchMeetings();
    }
  }, [activeTab, token, API_URL, logout]);

  const handleJoin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (joinCode.trim()) {
      let code = joinCode.trim();
      if (code.includes('/meeting/')) code = code.split('/meeting/')[1].split('/')[0];
      navigate(`/meeting/${code}`);
    }
  };

  const startInstantMeeting = async () => {
    try {
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Instant Meeting', roomId: instantRoomCode, isWaitingRoom: instantWaitingRoom })
      });
      if (res.ok) {
        navigate(`/meeting/${instantRoomCode}`);
      } else {
        throw new Error('Failed to start meeting');
      }
    } catch (err) { 
      const error = err as Error;
      showToast(error.message || 'Error creating meeting', 'error'); 
    }
  };

  const copyToClipboard = (text: string, isLink: boolean = false) => {
    navigator.clipboard.writeText(text);
    showToast(isLink ? 'Invite Link copied!' : 'Room Code copied!', 'success');
  };

  const handleScheduleMeeting = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsScheduling(true);
    const newRoomId = generateRoomCode();
    try {
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: meetingTitle, date: meetingDate, time: meetingTime, roomId: newRoomId, isWaitingRoom })
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledMeetings(prev => [...prev, data]);
        setShowScheduleModal(false);
        setMeetingTitle(''); setMeetingDate(''); setMeetingTime('');
        showToast('Meeting Scheduled!', 'success');
      } else {
        throw new Error('Failed to schedule');
      }
    } catch (err) { 
      const error = err as Error;
      showToast(error.message || 'Failed to schedule', 'error'); 
    } finally { 
      setIsScheduling(false); 
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/meetings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setScheduledMeetings(prev => prev.filter(m => m._id !== id));
        showToast('Meeting removed', 'success');
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim() || newName === user?.name) return;
    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        const data = await res.json();
        if (user) setUser({ ...user, name: data.name });
        showToast('Profile updated!', 'success');
      } else {
        throw new Error('Update failed');
      }
    } catch (err) { 
      showToast('Error updating profile', 'error'); 
    } finally { 
      setIsUpdatingProfile(false); 
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || newPassword.length < 6) return;
    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        showToast('Password updated!', 'success');
        setCurrentPassword(''); setNewPassword('');
      } else {
        throw new Error('Password update failed');
      }
    } catch (err) { 
      showToast('Error updating password', 'error'); 
    } finally { 
      setIsUpdatingPassword(false); 
    }
  };

  const handleUpdateTaskStatus = async (roomId: string, taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    try {
      const res = await fetch(`${API_URL}/meetings/room/${roomId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        setScheduledMeetings(prev => prev.map(m => {
          if (m.roomId === roomId && m.tasks) {
            return { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } as TaskData : t) };
          }
          return m;
        }));
        showToast('Task updated!', 'success');
      }
    } catch (err) {
      showToast('Failed to update task', 'error');
    }
  };

  const handleDeleteTask = async (roomId: string, taskId: string) => {
    if(!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`${API_URL}/meetings/room/${roomId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setScheduledMeetings(prev => prev.map(m => {
          if (m.roomId === roomId && m.tasks) {
            return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
          }
          return m;
        }));
        showToast('Task deleted successfully!', 'success');
      }
    } catch (err) {
      showToast('Failed to delete task', 'error');
    }
  };

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];

  const upcomingMeetings = scheduledMeetings.filter(m => m.status !== 'Completed' && (m.date > currentDate || (m.date === currentDate && m.time >= currentTime)));
  const pastMeetings = scheduledMeetings.filter(m => m.status === 'Completed' || m.date < currentDate || (m.date === currentDate && m.time < currentTime));

  const allTasks = scheduledMeetings.flatMap(m => 
    (m.tasks || []).map(t => ({ ...t, roomId: m.roomId, roomTitle: m.title }))
  );
  
  const todoTasks = allTasks.filter(t => t.status === 'todo');
  const inProgressTasks = allTasks.filter(t => t.status === 'in-progress');
  const doneTasks = allTasks.filter(t => t.status === 'done');

  const meetingDatesMap = scheduledMeetings.reduce((acc, m) => {
    const d = m.date.substring(5); 
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const trendData = Object.keys(meetingDatesMap).slice(-7).map(date => ({
    name: date,
    Meetings: meetingDatesMap[date]
  }));

  const pieChartData = [
    { name: 'To Do', value: todoTasks.length, color: '#ef4444' }, 
    { name: 'In Progress', value: inProgressTasks.length, color: '#eab308' }, 
    { name: 'Done', value: doneTasks.length, color: '#10b981' }, 
  ].filter(item => item.value > 0);

  const meetingWiseData = scheduledMeetings
    .filter(m => m.tasks && m.tasks.length > 0)
    .slice(-6)
    .map(m => ({
      name: m.title.length > 12 ? m.title.substring(0, 12) + '...' : m.title,
      fullTitle: m.title,
      date: m.date,
      'To Do': (m.tasks || []).filter(t => t.status === 'todo').length,
      'In Progress': (m.tasks || []).filter(t => t.status === 'in-progress').length,
      'Done': (m.tasks || []).filter(t => t.status === 'done').length,
      total: (m.tasks || []).length,
      progress: Math.round(((m.tasks || []).filter(t => t.status === 'done').length / (m.tasks || []).length) * 100)
    }));

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white flex flex-col md:flex-row font-sans relative overflow-hidden">
      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl z-[100] border-l-4 animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-slate-800 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-red-500 text-red-400'}`}>
          <p className="font-semibold text-sm">{toast.msg}</p>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button onClick={() => setShowScheduleModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-500"><Calendar size={24}/> Schedule Meeting</h2>
            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <input type="text" value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} placeholder="Title" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500" required />
                <input type="time" value={meetingTime} onChange={e=>setMeetingTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500" required />
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isWaitingRoom} onChange={e => setIsWaitingRoom(e.target.checked)} className="rounded text-blue-500 bg-slate-800 border-slate-700 w-4 h-4" />
                Enable Waiting Room
              </label>
              <button type="submit" disabled={isScheduling} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition">
                {isScheduling && <Loader2 size={18} className="animate-spin" />} Confirm
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SIDEBAR (Desktop Only for Profile) / MOBILE BOTTOM NAV --- */}
      <div className="w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 flex flex-row md:flex-col justify-between fixed bottom-0 md:relative z-50 md:z-auto order-last md:order-first px-2 md:px-0 pb-safe md:pb-0">
         <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded-xl"><Video size={24} className="text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">IntellMeet</h1>
         </div>
         
         <div className="flex flex-row md:flex-col w-full md:flex-1 p-2 md:p-4 gap-1 sm:gap-2 justify-between md:justify-start overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all min-w-[60px] md:min-w-0 ${activeTab === 'home' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <Video size={22} className="md:w-5 md:h-5" />
               <span className="text-[10px] md:text-sm font-medium">Home</span>
            </button>
            <button onClick={() => setActiveTab('schedule')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all min-w-[60px] md:min-w-0 ${activeTab === 'schedule' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <Calendar size={22} className="md:w-5 md:h-5" />
               <span className="text-[10px] md:text-sm font-medium">Schedule</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all min-w-[60px] md:min-w-0 ${activeTab === 'history' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <History size={22} className="md:w-5 md:h-5" />
               <span className="text-[10px] md:text-sm font-medium">History</span>
            </button>
            <button onClick={() => setActiveTab('tasks')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all min-w-[60px] md:min-w-0 ${activeTab === 'tasks' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <CheckSquare size={22} className="md:w-5 md:h-5" />
              <span className="text-[10px] md:text-sm font-medium">Tasks</span>
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all min-w-[60px] md:min-w-0 ${activeTab === 'analytics' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <BarChart3 size={22} className="md:w-5 md:h-5" />
              <span className="text-[10px] md:text-sm font-medium">Analytics</span>
            </button>
            
            <button onClick={() => setActiveTab('profile')} className={`hidden md:flex md:flex-row items-center md:gap-3 md:px-4 md:py-3 rounded-xl transition-all md:min-w-0 ${activeTab === 'profile' ? 'bg-blue-600/15 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <User size={22} className="md:w-5 md:h-5" />
               <span className="text-[10px] md:text-sm font-medium">Profile</span>
            </button>
         </div>

         <div className="hidden md:block p-4 border-t border-slate-800 mt-auto">
            <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
               <LogOut size={20} />
               <span className="text-sm font-medium">Logout</span>
            </button>
         </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-950 pb-20 md:pb-0">
         
         {/* MOBILE TOP HEADER */}
         <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-40 shadow-md">
            <div className="flex items-center gap-2">
               <div className="bg-blue-600 p-1.5 rounded-lg"><Video size={20} className="text-white" /></div>
               <h1 className="text-lg font-bold tracking-tight">IntellMeet</h1>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setActiveTab('profile')} 
                 className={`p-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'}`}
                 title="Profile Settings"
               >
                 <User size={18} />
               </button>

               <button 
                 onClick={() => { logout(); navigate('/'); }} 
                 className="text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                 title="Logout"
               >
                 <LogOut size={18} />
               </button>
            </div>
         </div>

         <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 mt-2 md:mt-4">
            
            {activeTab === 'home' && (
               <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                  <div className="flex items-center gap-4 mb-6 md:mb-8">
                     <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xl md:text-2xl font-bold border-[3px] md:border-4 border-slate-800 shadow-xl uppercase">
                        {(user?.name || user?.firstName || 'U').charAt(0)}
                     </div>
                     <div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.name || user?.firstName || 'User'}!</h2>
                        <p className="text-slate-400 text-sm md:text-base">Ready for your next meeting?</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                     <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
                        <div>
                           <div className="bg-blue-500/10 border border-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                              <Video size={24} className="text-blue-400" />
                           </div>
                           <h3 className="text-lg md:text-xl font-bold mb-2">New Meeting</h3>
                           <p className="text-slate-400 text-sm mb-4">Start an instant meeting with a secure code.</p>
                           <label className="flex items-center gap-2 mb-4 text-sm text-slate-300 cursor-pointer">
                             <input type="checkbox" checked={instantWaitingRoom} onChange={e => setInstantWaitingRoom(e.target.checked)} className="rounded text-blue-500 bg-slate-800 border-slate-700 w-4 h-4" />
                             Enable Waiting Room
                           </label>
                        </div>
                        <div className="space-y-3">
                           <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <span className="text-sm font-mono text-slate-300 font-bold tracking-wider">{instantRoomCode}</span>
                              <div className="flex gap-1">
                                 <button onClick={() => copyToClipboard(instantRoomCode, false)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"><Copy size={16}/></button>
                                 <button onClick={() => copyToClipboard(`${window.location.origin}/meeting/${instantRoomCode}`, true)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-blue-400 rounded-md transition-colors"><LinkIcon size={16}/></button>
                              </div>
                           </div>
                           <button onClick={startInstantMeeting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-sm md:text-base">
                              Start Instant Meeting
                           </button>
                        </div>
                     </div>

                     <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
                        <div>
                           <div className="bg-emerald-500/10 border border-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                              <Users size={24} className="text-emerald-400" />
                           </div>
                           <h3 className="text-lg md:text-xl font-bold mb-2">Join Meeting</h3>
                           <p className="text-slate-400 text-sm mb-6">Enter a room code or full link to join.</p>
                        </div>
                        <form onSubmit={handleJoin} className="space-y-3">
                           <input 
                              type="text" 
                              placeholder="Enter Link or Code" 
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-3 text-sm outline-none transition-all"
                           />
                           <button type="submit" disabled={!joinCode.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-sm md:text-base">
                              Join Meeting
                           </button>
                        </form>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'schedule' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 md:mb-8">
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold">Upcoming Meetings</h2>
                        <p className="text-slate-400 text-sm mt-1">Plan and manage your schedule</p>
                     </div>
                     <button onClick={() => setShowScheduleModal(true)} className="w-full sm:w-auto flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm">
                        <Plus size={18} /> Schedule New
                     </button>
                  </div>

                  {isLoadingMeetings ? (
                     <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                  ) : upcomingMeetings.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {upcomingMeetings.map(meeting => (
                           <div key={meeting._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative group">
                              <h3 className="font-bold text-lg text-white mb-1 pr-16 truncate">{meeting.title}</h3>
                              {meeting.isWaitingRoom && (
                                <span className="absolute top-4 right-4 text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-1 rounded-md flex items-center">
                                  <ShieldAlert size={12} className="mr-1"/> Waiting
                                </span>
                              )}
                              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><Clock size={14}/> {meeting.date} at {meeting.time}</p>
                              
                              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 mb-4">
                                 <span className="text-xs font-mono text-slate-300 font-bold tracking-wider truncate mr-2">{meeting.roomId}</span>
                                 <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => copyToClipboard(meeting.roomId, false)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"><Copy size={14}/></button>
                                    <button onClick={() => copyToClipboard(`${window.location.origin}/meeting/${meeting.roomId}`, true)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-blue-400 rounded-md transition-colors"><LinkIcon size={14}/></button>
                                 </div>
                              </div>

                              <div className="flex gap-2">
                                <button onClick={() => navigate(`/meeting/${meeting.roomId}`)} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-bold transition-colors">Start / Join</button>
                                <button onClick={() => handleDeleteMeeting(meeting._id)} className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
                           <div className="bg-slate-800 p-4 rounded-full mb-4"><Calendar size={32} className="text-slate-400" /></div>
                           <h3 className="text-lg font-bold mb-2">No upcoming meetings</h3>
                           <p className="text-slate-400 text-sm max-w-sm mb-6">Schedule a new meeting with your team to get started.</p>
                           <button onClick={() => setShowScheduleModal(true)} className="sm:hidden flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-medium transition-colors text-sm">
                              <Plus size={18} /> Schedule Meeting
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'history' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Meeting History</h2>
                  {isLoadingMeetings ? (
                     <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                  ) : pastMeetings.length > 0 ? (
                     <div className="grid grid-cols-1 gap-4">
                        {pastMeetings.map(meeting => (
                           <div key={meeting._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:border-slate-700">
                              <div className="flex-1 w-full">
                                <h3 className="font-bold text-base md:text-lg text-white mb-1 truncate">{meeting.title}</h3>
                                <p className="text-xs md:text-sm text-slate-400 flex items-center gap-2"><Clock size={14}/> {meeting.date} at {meeting.time}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                {(meeting.status === 'Completed' || meeting.summary) && (
                                    <button onClick={() => navigate(`/summary/${meeting.roomId}`)} className="flex-1 md:flex-none bg-purple-600/10 border border-purple-500/30 text-purple-400 hover:bg-purple-600 hover:text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2">
                                      <FileText size={16} /> <span className="hidden sm:inline">View Report</span><span className="sm:hidden">Report</span>
                                    </button>
                                )}
                                <button onClick={() => navigate(`/meeting/${meeting.roomId}`)} className="flex-1 md:flex-none bg-slate-800 border border-slate-700 hover:bg-blue-600 hover:border-blue-500 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white">Rejoin</button>
                                <button onClick={() => handleDeleteMeeting(meeting._id)} className="bg-slate-800 border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 px-3 py-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
                           <div className="bg-slate-800 p-4 rounded-full mb-4"><History size={32} className="text-slate-400" /></div>
                           <h3 className="text-lg font-bold mb-2">No Past Meetings</h3>
                           <p className="text-slate-400 text-sm max-w-sm">Your meeting history is completely clean.</p>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'tasks' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 w-full">
                  <div className="flex justify-between items-end mb-6 md:mb-8">
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-blue-400">AI Task Board</h2>
                        <p className="text-slate-400 text-sm mt-1">Smart Action Items extracted from your meetings</p>
                     </div>
                  </div>
                  
                  {isLoadingMeetings ? <Loader2 className="animate-spin mx-auto text-blue-500" size={32} /> : (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
                        {/* To Do Column */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col max-h-[65vh]">
                           <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2 pb-3 border-b border-slate-800 text-sm uppercase tracking-wider">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> To Do ({todoTasks.length})
                           </h3>
                           <div className="space-y-3 overflow-y-auto pb-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                              {todoTasks.length === 0 && <p className="text-sm text-slate-500 text-center mt-6 mb-6">No tasks pending</p>}
                              {todoTasks.map(t => (
                                 <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition relative group">
                                    <button onClick={() => handleDeleteTask(t.roomId, t.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                       <Trash2 size={14} />
                                    </button>
                                    <p className="text-sm text-slate-300 mb-4 mt-1 leading-relaxed pr-6">{t.text}</p>
                                    <div className="flex justify-between items-center text-xs">
                                       <span className="text-slate-500 truncate max-w-[100px]">{t.roomTitle}</span>
                                       <button onClick={() => handleUpdateTaskStatus(t.roomId, t.id, 'in-progress')} className="bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition font-medium border border-slate-700 hover:border-blue-500">Start Task</button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        {/* In Progress Column */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col max-h-[65vh]">
                           <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2 pb-3 border-b border-slate-800 text-sm uppercase tracking-wider">
                              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> In Progress ({inProgressTasks.length})
                           </h3>
                           <div className="space-y-3 overflow-y-auto pb-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                              {inProgressTasks.length === 0 && <p className="text-sm text-slate-500 text-center mt-6 mb-6">Nothing in progress</p>}
                              {inProgressTasks.map(t => (
                                 <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition relative group">
                                    <button onClick={() => handleDeleteTask(t.roomId, t.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                       <Trash2 size={14} />
                                    </button>
                                    <p className="text-sm text-slate-300 mb-4 mt-1 leading-relaxed pr-6">{t.text}</p>
                                    <div className="flex justify-between items-center text-xs">
                                       <span className="text-slate-500 truncate max-w-[80px]">{t.roomTitle}</span>
                                       <div className="flex gap-1.5">
                                          <button onClick={() => handleUpdateTaskStatus(t.roomId, t.id, 'todo')} className="bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition border border-slate-700">Back</button>
                                          <button onClick={() => handleUpdateTaskStatus(t.roomId, t.id, 'done')} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg transition font-medium border border-emerald-500/30 hover:border-emerald-500">Done</button>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        {/* Done Column */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col max-h-[65vh]">
                           <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2 pb-3 border-b border-slate-800 text-sm uppercase tracking-wider">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Done ({doneTasks.length})
                           </h3>
                           <div className="space-y-3 overflow-y-auto pb-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                              {doneTasks.length === 0 && <p className="text-sm text-slate-500 text-center mt-6 mb-6">No completed tasks yet</p>}
                              {doneTasks.map(t => (
                                 <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-emerald-500/10 opacity-75 hover:opacity-100 transition relative group">
                                    <button onClick={() => handleDeleteTask(t.roomId, t.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                       <Trash2 size={14} />
                                    </button>
                                    <p className="text-sm text-slate-500 mb-4 mt-1 line-through decoration-slate-700 pr-6">{t.text}</p>
                                    <div className="flex justify-between items-center text-xs">
                                       <span className="text-slate-600 truncate max-w-[100px]">{t.roomTitle}</span>
                                       <button onClick={() => handleUpdateTaskStatus(t.roomId, t.id, 'in-progress')} className="text-slate-500 hover:text-slate-300 px-2 py-1 transition font-medium">Re-open</button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'analytics' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-w-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 mb-6 md:mb-8">
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Insights & Analytics</h2>
                        <p className="text-slate-400 text-sm mt-1">Track your productivity and meeting stats</p>
                     </div>
                  </div>

                  {isLoadingMeetings ? <Loader2 className="animate-spin mx-auto text-blue-500" size={32} /> : (
                     <div className="space-y-4 md:space-y-6 min-w-0">
                        
                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl">
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-sm">
                              <Calendar size={20} className="text-blue-400 mb-2 md:mb-3" />
                              <h4 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Meetings</h4>
                              <span className="text-2xl md:text-3xl font-bold text-white">{scheduledMeetings.length}</span>
                           </div>
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-sm">
                              <Target size={20} className="text-purple-400 mb-2 md:mb-3" />
                              <h4 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Tasks</h4>
                              <span className="text-2xl md:text-3xl font-bold text-white">{allTasks.length}</span>
                           </div>
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-sm">
                              <CheckCircle2 size={20} className="text-emerald-400 mb-2 md:mb-3" />
                              <h4 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Tasks Done</h4>
                              <span className="text-2xl md:text-3xl font-bold text-white">{doneTasks.length}</span>
                           </div>
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-sm">
                              <TrendingUp size={20} className="text-cyan-400 mb-2 md:mb-3" />
                              <h4 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Completion %</h4>
                              <span className="text-2xl md:text-3xl font-bold text-cyan-400">
                                 {allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0}%
                              </span>
                           </div>
                        </div>

                        {/* Top Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-w-0 max-w-6xl">
                           
                           {/* Area Chart */}
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl shadow-sm min-w-0">
                              <div className="flex items-center gap-2 mb-4 md:mb-6">
                                 <Activity size={18} className="text-blue-400" />
                                 <h3 className="text-base md:text-lg font-bold text-slate-200">Meeting Trends (7 Days)</h3>
                              </div>
                              {trendData.length > 0 ? (
                                <div className="h-[220px] md:h-[260px] w-full min-w-0">
                                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                      <defs>
                                        <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}/>
                                      <Area type="monotone" dataKey="Meetings" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMeetings)" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="h-[220px] md:h-[260px] flex items-center justify-center text-slate-500 text-sm">No meeting data available</div>
                              )}
                           </div>

                           {/* Pie Chart */}
                           <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl shadow-sm min-w-0">
                              <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 text-slate-200">Task Status</h3>
                              {pieChartData.length > 0 ? (
                                <div className="h-[220px] md:h-[260px] w-full flex flex-col items-center justify-center min-w-0">
                                  <ResponsiveContainer width="100%" height="80%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                      <Pie
                                        data={pieChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none"
                                      >
                                        {pieChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} itemStyle={{ color: '#fff' }}/>
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="flex flex-wrap gap-3 w-full justify-center mt-2 px-2 pb-2">
                                    {pieChartData.map((entry, index) => (
                                      <div key={index} className="flex items-center gap-1.5 text-xs">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                        <span className="text-slate-400">{entry.name} <span className="font-bold text-slate-200">({entry.value})</span></span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-[220px] md:h-[260px] flex items-center justify-center text-slate-500 text-sm">No task data available</div>
                              )}
                           </div>
                        </div>

                        {/* Table */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden min-w-0 max-w-6xl">
                           <div className="p-4 md:p-6 border-b border-slate-800">
                              <h3 className="text-base md:text-lg font-bold text-slate-200">Recent Performance Table</h3>
                           </div>
                           <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                              <table className="w-full text-left border-collapse min-w-[600px]">
                                 <thead>
                                    <tr className="bg-slate-950 text-slate-500 text-xs uppercase tracking-wider">
                                       <th className="p-4 font-semibold w-1/3">Meeting Title</th>
                                       <th className="p-4 font-semibold">Date</th>
                                       <th className="p-4 font-semibold text-center">Total Tasks</th>
                                       <th className="p-4 font-semibold w-1/3">Task Progress</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-800">
                                    {meetingWiseData.length > 0 ? (
                                      meetingWiseData.slice().reverse().map((meeting, idx) => (
                                       <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                          <td className="p-4 text-sm font-medium text-slate-200">{meeting.fullTitle}</td>
                                          <td className="p-4 text-sm text-slate-400">{meeting.date}</td>
                                          <td className="p-4 text-sm text-center">
                                             <span className="bg-slate-950 px-2.5 py-1 rounded-md text-slate-300 border border-slate-800">{meeting.total}</span>
                                          </td>
                                          <td className="p-4">
                                             <div className="flex items-center gap-3">
                                                <div className="w-full bg-slate-800 rounded-full h-2">
                                                   <div 
                                                     className={`h-2 rounded-full ${meeting.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                                     style={{ width: `${meeting.progress}%` }}
                                                   ></div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-300 w-8">{meeting.progress}%</span>
                                             </div>
                                          </td>
                                       </tr>
                                      ))
                                    ) : (
                                      <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm">No meeting performance data yet</td></tr>
                                    )}
                                 </tbody>
                              </table>
                           </div>
                        </div>

                     </div>
                  )}
               </div>
            )}

            {activeTab === 'profile' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Profile Settings</h2>
                  
                  <div className="space-y-4 md:space-y-6">
                     <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                        <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><Edit2 size={18} className="text-blue-400"/> Personal Information</h3>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none text-white" />
                           </div>
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Email</label>
                              <input type="email" value={user?.email || ''} disabled className="w-full bg-slate-950/50 border border-slate-800/50 text-slate-500 cursor-not-allowed rounded-lg p-3 text-sm" />
                           </div>
                           <button 
                             onClick={handleUpdateProfile} 
                             disabled={isUpdatingProfile || newName === (user?.name || user?.firstName)}
                             className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 w-full md:w-auto"
                           >
                             {isUpdatingProfile && <Loader2 size={16} className="animate-spin" />}
                             Save Changes
                           </button>
                        </div>
                     </div>

                     <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                        <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><Lock size={18} className="text-emerald-400"/> Change Password</h3>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Current Password</label>
                              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none text-white" />
                           </div>
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">New Password</label>
                              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none text-white" />
                           </div>
                           <button 
                             onClick={handleUpdatePassword} 
                             disabled={isUpdatingPassword || !currentPassword || !newPassword}
                             className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors border border-slate-700 flex items-center justify-center gap-2 w-full md:w-auto"
                           >
                             {isUpdatingPassword && <Loader2 size={16} className="animate-spin" />}
                             Update Password
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:resettoken" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meeting/:roomId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        <Route path="/summary/:roomId" element={<ProtectedRoute><MeetingSummary /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}