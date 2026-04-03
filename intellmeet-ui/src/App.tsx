import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { 
  Video, Calendar, User, LogOut, Copy, Plus, 
  Users, Edit2, Lock, Loader2, X, Trash2, Clock, ShieldAlert, History, Link as LinkIcon
} from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import MeetingRoom from './pages/MeetingRoom';
import { useAuthStore } from './store/authStore';

// 🔥 Proper TypeScript Interfaces
interface MeetingData {
  _id: string;
  title: string;
  date: string;
  time: string;
  roomId: string;
  isWaitingRoom?: boolean;
}

interface AuthState {
  token: string | null;
  user: any;
  logout: () => void;
  setUser: (user: any) => void;
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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
  
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'history' | 'profile'>('home');
  const [joinCode, setJoinCode] = useState('');
  const [instantRoomCode] = useState(generateRoomCode());
  const [instantWaitingRoom, setInstantWaitingRoom] = useState(false);
  
  // 🔥 Safe environment variable casting for TypeScript
  const base_url = ((import.meta as any).env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/api\/?$/, '');
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
    if ((activeTab === 'schedule' || activeTab === 'history') && token) {
      const fetchMeetings = async () => {
        setIsLoadingMeetings(true);
        try {
          const res = await fetch(`${API_URL}/meetings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.status === 401) {
            logout();
            return;
          }
          if (res.ok) {
            const data = await res.json();
            setScheduledMeetings(data);
          }
        } catch (err) {
          console.error("Failed to fetch meetings", err);
        } finally {
          setIsLoadingMeetings(false);
        }
      };
      fetchMeetings();
    }
  }, [activeTab, token, API_URL, logout]);

  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (joinCode.trim()) {
      let code = joinCode.trim();
      if (code.includes('/meeting/')) {
        code = code.split('/meeting/')[1].split('/')[0].split('?')[0]; 
      }
      navigate(`/meeting/${code}`);
    }
  };

  const startInstantMeeting = async () => {
    try {
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          title: 'Instant Meeting', 
          roomId: instantRoomCode, 
          isWaitingRoom: instantWaitingRoom 
        })
      });
      if (!res.ok) {
        if (res.status === 401) {
           logout();
           throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to start meeting');
      }
      navigate(`/meeting/${instantRoomCode}`);
    } catch (err: any) {
      showToast(err.message || 'Error creating meeting', 'error');
    }
  };

  const copyToClipboard = (text: string, isLink: boolean = false) => {
    navigator.clipboard.writeText(text);
    showToast(isLink ? 'Invite Link copied!' : 'Room Code copied!', 'success');
  };

  const handleScheduleMeeting = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsScheduling(true);
    const newRoomId = generateRoomCode();
    try {
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          title: meetingTitle, 
          date: meetingDate, 
          time: meetingTime, 
          roomId: newRoomId, 
          isWaitingRoom 
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
            logout();
            throw new Error('Session expired. Please login again.');
        }
        const data = await res.json();
        throw new Error(data.message || 'Failed to schedule');
      }
      
      const data = await res.json();
      setScheduledMeetings(prev => [...prev, data]);
      setShowScheduleModal(false);
      setMeetingTitle(''); setMeetingDate(''); setMeetingTime(''); setIsWaitingRoom(false);
      showToast('Meeting Scheduled Successfully!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
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
        showToast('Meeting removed from history', 'success');
      } else if (res.status === 401) {
        logout();
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
      if (!res.ok) {
          if(res.status === 401) logout();
          const data = await res.json();
          throw new Error(data.message || 'Failed to update profile');
      }
      const data = await res.json();
      if (user) setUser({ ...user, name: data.name });
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) { 
      showToast(err.message, 'error'); 
    } finally { 
      setIsUpdatingProfile(false); 
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || newPassword.length < 6) { 
      showToast('Password must be at least 6 characters long.', 'error'); 
      return; 
    }
    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!res.ok) {
          if(res.status === 401) logout();
          throw new Error('Failed to update password');
      }
      showToast('Password updated securely!', 'success');
      setCurrentPassword(''); 
      setNewPassword('');
    } catch (err: any) { 
      showToast(err.message, 'error'); 
    } finally { 
      setIsUpdatingPassword(false); 
    }
  };

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];

  const upcomingMeetings = scheduledMeetings.filter(m => m.date > currentDate || (m.date === currentDate && m.time >= currentTime));
  const pastMeetings = scheduledMeetings.filter(m => m.date < currentDate || (m.date === currentDate && m.time < currentTime));

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row font-sans relative">
      
      {toast && (
        <div className={`fixed top-4 right-4 md:top-8 md:right-8 p-4 rounded-xl shadow-2xl z-[100] border-l-4 animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-slate-800 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-red-500 text-red-400'}`}>
          <p className="font-semibold text-sm">{toast.msg}</p>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button onClick={() => setShowScheduleModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Calendar size={24} className="text-blue-500"/> Schedule Meeting</h2>
            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Meeting Title</label>
                <input type="text" value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} placeholder="Project Sync" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time</label>
                  <input type="time" value={meetingTime} onChange={e=>setMeetingTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" required />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isWaitingRoom} onChange={e => setIsWaitingRoom(e.target.checked)} className="rounded text-blue-500 bg-slate-800 border-slate-700 w-4 h-4" />
                Enable Waiting Room (Require Approval)
              </label>
              <button type="submit" disabled={isScheduling} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4 transition-colors flex justify-center items-center gap-2">
                {isScheduling && <Loader2 size={18} className="animate-spin" />}
                Confirm Schedule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 flex flex-row md:flex-col justify-between fixed bottom-0 md:relative z-50 md:z-auto order-last md:order-first">
         <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded-xl"><Video size={24} className="text-white" /></div>
            <h1 className="text-2xl font-bold tracking-tight">IntellMeet</h1>
         </div>
         
         <div className="flex flex-row md:flex-col w-full md:flex-1 p-2 md:p-4 gap-1 md:gap-2 justify-around md:justify-start">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-3 md:px-4 md:py-3 rounded-xl transition-all ${activeTab === 'home' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <Video size={20} />
               <span className="text-[10px] md:text-sm font-medium">Home</span>
            </button>
            <button onClick={() => setActiveTab('schedule')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-3 md:px-4 md:py-3 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <Calendar size={20} />
               <span className="text-[10px] md:text-sm font-medium">Schedule</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-3 md:px-4 md:py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <History size={20} />
               <span className="text-[10px] md:text-sm font-medium">History</span>
            </button>
            <button onClick={() => setActiveTab('profile')} className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-3 md:px-4 md:py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
               <User size={20} />
               <span className="text-[10px] md:text-sm font-medium">Profile</span>
            </button>
         </div>

         <div className="hidden md:block p-4 border-t border-slate-800">
            <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors">
               <LogOut size={20} />
               <span className="text-sm font-medium">Logout</span>
            </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0 bg-slate-900">
         
         <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
            <div className="flex items-center gap-2">
               <div className="bg-blue-600 p-1.5 rounded-lg"><Video size={20} className="text-white" /></div>
               <h1 className="text-xl font-bold tracking-tight">IntellMeet</h1>
            </div>
            <button onClick={() => { logout(); navigate('/'); }} className="text-slate-400 hover:text-red-400"><LogOut size={20} /></button>
         </div>

         <div className="max-w-4xl mx-auto p-4 md:p-8 mt-4 md:mt-8">
            
            {/* Home Tab */}
            {activeTab === 'home' && (
               <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold border-4 border-slate-800 shadow-xl uppercase">
                        {(user?.name || user?.firstName || 'U').charAt(0)}
                     </div>
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold">Welcome back, {user?.name || user?.firstName || 'User'}!</h2>
                        <p className="text-slate-400 text-sm md:text-base">Ready for your next great meeting?</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                     <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between shadow-lg">
                        <div>
                           <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                              <Video size={24} className="text-blue-400" />
                           </div>
                           <h3 className="text-xl font-bold mb-2">New Meeting</h3>
                           <p className="text-slate-400 text-sm mb-4">Start an instant meeting with a secure, random code.</p>
                           <label className="flex items-center gap-2 mb-4 text-sm text-slate-300 cursor-pointer">
                             <input type="checkbox" checked={instantWaitingRoom} onChange={e => setInstantWaitingRoom(e.target.checked)} className="rounded text-blue-500 bg-slate-900 border-slate-700 w-4 h-4" />
                             Enable Waiting Room
                           </label>
                        </div>
                        <div className="space-y-3">
                           <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <span className="text-sm font-mono text-slate-300 font-bold tracking-wider">{instantRoomCode}</span>
                              <div className="flex gap-1">
                                 <button onClick={() => copyToClipboard(instantRoomCode, false)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors" title="Copy Code"><Copy size={16}/></button>
                                 <button onClick={() => copyToClipboard(`${window.location.origin}/meeting/${instantRoomCode}`, true)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-blue-400 rounded-md transition-colors" title="Copy Invite Link"><LinkIcon size={16}/></button>
                              </div>
                           </div>
                           <button onClick={startInstantMeeting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">
                              Start Instant Meeting
                           </button>
                        </div>
                     </div>

                     <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between shadow-lg">
                        <div>
                           <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                              <Users size={24} className="text-emerald-400" />
                           </div>
                           <h3 className="text-xl font-bold mb-2">Join Meeting</h3>
                           <p className="text-slate-400 text-sm mb-6">Enter a room code or full link to join an ongoing meeting.</p>
                        </div>
                        <form onSubmit={handleJoin} className="space-y-3">
                           <input 
                              type="text" 
                              placeholder="Enter Link or Code" 
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-3 text-sm outline-none transition-all"
                           />
                           <button type="submit" disabled={!joinCode.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">
                              Join Meeting
                           </button>
                        </form>
                     </div>
                  </div>
               </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end mb-8">
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold">Upcoming Meetings</h2>
                        <p className="text-slate-400 text-sm mt-1">Plan and manage your schedule</p>
                     </div>
                     <button onClick={() => setShowScheduleModal(true)} className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors">
                        <Plus size={18} /> Schedule New
                     </button>
                  </div>

                  {isLoadingMeetings ? (
                     <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                  ) : upcomingMeetings.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcomingMeetings.map(meeting => (
                           <div key={meeting._id} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 shadow-lg relative group">
                              <h3 className="font-bold text-lg text-white mb-1">{meeting.title}</h3>
                              {meeting.isWaitingRoom && (
                                <span className="absolute top-4 right-4 text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full flex items-center">
                                  <ShieldAlert size={12} className="mr-1"/> Waiting Room
                                </span>
                              )}
                              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><Clock size={14}/> {meeting.date} at {meeting.time}</p>
                              
                              <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800 mb-4">
                                 <span className="text-xs font-mono text-slate-300 font-bold tracking-wider truncate mr-2">{meeting.roomId}</span>
                                 <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => copyToClipboard(meeting.roomId, false)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors" title="Copy Code"><Copy size={14}/></button>
                                    <button onClick={() => copyToClipboard(`${window.location.origin}/meeting/${meeting.roomId}`, true)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-blue-400 rounded-md transition-colors" title="Copy Invite Link"><LinkIcon size={14}/></button>
                                 </div>
                              </div>

                              <div className="flex gap-2">
                                <button onClick={() => navigate(`/meeting/${meeting.roomId}`)} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-bold transition-colors">Start / Join</button>
                                <button onClick={() => handleDeleteMeeting(meeting._id)} className="bg-slate-700 hover:bg-red-600/20 hover:text-red-400 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="p-10 flex flex-col items-center justify-center text-center">
                           <div className="bg-slate-800 p-4 rounded-full mb-4"><Calendar size={32} className="text-slate-400" /></div>
                           <h3 className="text-lg font-bold mb-2">No upcoming meetings</h3>
                           <p className="text-slate-400 text-sm max-w-sm mb-6">Click the button below to schedule a new meeting with your team.</p>
                           <button onClick={() => setShowScheduleModal(true)} className="md:hidden flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-medium transition-colors">
                              <Plus size={18} /> Schedule Meeting
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end mb-8">
                     <div>
                        <h2 className="text-2xl md:text-3xl font-bold">Meeting History</h2>
                        <p className="text-slate-400 text-sm mt-1">Access or rejoin your past meetings</p>
                     </div>
                  </div>

                  {isLoadingMeetings ? (
                     <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                  ) : pastMeetings.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pastMeetings.map(meeting => (
                           <div key={meeting._id} className="bg-slate-800/20 border border-slate-700 rounded-2xl p-5 relative group opacity-80 hover:opacity-100 transition-opacity">
                              <h3 className="font-bold text-lg text-white mb-1">{meeting.title}</h3>
                              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><Clock size={14}/> {meeting.date} at {meeting.time}</p>
                              
                              <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800 mb-4">
                                 <span className="text-xs font-mono text-slate-300 font-bold tracking-wider truncate mr-2">{meeting.roomId}</span>
                                 <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => copyToClipboard(meeting.roomId, false)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors" title="Copy Code"><Copy size={14}/></button>
                                    <button onClick={() => copyToClipboard(`${window.location.origin}/meeting/${meeting.roomId}`, true)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-blue-400 rounded-md transition-colors" title="Copy Invite Link"><LinkIcon size={14}/></button>
                                 </div>
                              </div>

                              <div className="flex gap-2">
                                <button onClick={() => navigate(`/meeting/${meeting.roomId}`)} className="flex-1 bg-slate-700 hover:bg-blue-600 py-2 rounded-lg text-sm font-bold transition-colors">Rejoin</button>
                                <button onClick={() => handleDeleteMeeting(meeting._id)} className="bg-slate-700 hover:bg-red-600/20 hover:text-red-400 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="p-10 flex flex-col items-center justify-center text-center">
                           <div className="bg-slate-800 p-4 rounded-full mb-4"><History size={32} className="text-slate-400" /></div>
                           <h3 className="text-lg font-bold mb-2">No Past Meetings</h3>
                           <p className="text-slate-400 text-sm max-w-sm mb-6">Your meeting history is clean.</p>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
                  <h2 className="text-2xl md:text-3xl font-bold mb-8">Profile Settings</h2>
                  
                  <div className="space-y-6">
                     <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit2 size={18} className="text-blue-400"/> Personal Information</h3>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                           </div>
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Email</label>
                              <input type="email" value={user?.email || ''} disabled className="w-full bg-slate-900/50 border border-slate-800 text-slate-500 cursor-not-allowed rounded-lg p-3 text-sm" />
                           </div>
                           <button 
                             onClick={handleUpdateProfile} 
                             disabled={isUpdatingProfile || newName === (user?.name || user?.firstName)}
                             className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                           >
                             {isUpdatingProfile && <Loader2 size={16} className="animate-spin" />}
                             Save Changes
                           </button>
                        </div>
                     </div>

                     <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock size={18} className="text-emerald-400"/> Change Password</h3>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">Current Password</label>
                              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none" />
                           </div>
                           <div>
                              <label className="block text-sm text-slate-400 mb-1">New Password</label>
                              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none" />
                           </div>
                           <button 
                             onClick={handleUpdatePassword} 
                             disabled={isUpdatingPassword || !currentPassword || !newPassword}
                             className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors border border-slate-600 flex items-center gap-2"
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
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meeting/:roomId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}