import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, Calendar, ArrowLeft, Loader2, BarChart3, Users, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuthStore } from '../store/authStore'; 

export default function MeetingSummary() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = useAuthStore((state: any) => state.user);

  useEffect(() => {
    const fetchMeetingData = async () => {
      try {
        const base_url = ((import.meta as any).env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/api\/?$/, '');
        const token = localStorage.getItem('token');
        
        const res = await fetch(`${base_url}/api/meetings/room/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMeeting(data);
        }
      } catch (err) {
        console.error("Failed to fetch meeting summary", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingData();
  }, [roomId]);

  const downloadNotes = () => {
    if (!meeting?.sharedNotes) {
      alert("No shared notes available for this meeting.");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([meeting.sharedNotes], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${meeting.title || 'Meeting'}_Shared_Notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
        <p className="text-xl font-bold text-slate-300">Loading Summary...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center font-sans">
        <p className="mb-4 text-slate-400">Meeting Not Found.</p>
        <button onClick={() => navigate('/dashboard')} className="bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700 transition">Back to Dashboard</button>
      </div>
    );
  }

  const summaryText = meeting.summary || "No AI summary was generated for this meeting. Either the meeting was too short or recording was disabled.";

  const tasks = meeting.tasks || [];
  const todoCount = tasks.filter((t: any) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t: any) => t.status === 'in-progress').length;
  const doneCount = tasks.filter((t: any) => t.status === 'done').length;

  const pieChartData = [
    { name: 'To Do', value: todoCount, color: '#ef4444' },
    { name: 'In Progress', value: inProgressCount, color: '#eab308' },
    { name: 'Done', value: doneCount, color: '#10b981' },
  ].filter(item => item.value > 0);
 
  const host = meeting.host;
  const participants = meeting.participants || [];
  const allUsers: any[] = [];
  
  if (host) allUsers.push({ ...host, isHost: true });
  participants.forEach((p: any) => {
    if (!allUsers.find(u => u._id === p._id)) {
      allUsers.push({ ...p, isHost: false });
    }
  });

  const isCurrentUserHost = Boolean(currentUser?.email && host?.email && currentUser.email === host.email);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 lg:p-10 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition bg-slate-900 px-4 py-2 rounded-lg shadow-md border border-slate-800 text-sm font-medium w-max">
             <ArrowLeft size={16} /> Back to Dashboard
           </button>
           
           <button onClick={downloadNotes} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition text-sm font-bold w-full sm:w-auto">
             <Download size={16} /> Download Notes (.txt)
           </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
               <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">{meeting.title || 'Meeting Summary'}</h1>
               <div className="flex flex-wrap gap-2 md:gap-3 text-sm text-slate-400 mt-4">
                 <span className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs md:text-sm">
                    <span className="text-blue-400 font-semibold">ID:</span> {meeting.roomId}
                 </span>
                 <span className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs md:text-sm">
                    <Calendar size={14} className="text-emerald-400" /> {meeting.date} at {meeting.time}
                 </span>
                 <span className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs md:text-sm">
                    <CheckCircle size={14} className="text-purple-400" /> Completed
                 </span>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4 w-full md:w-auto">
               <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center shadow-inner">
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">Participants</p>
                  <p className="text-xl md:text-2xl font-bold text-emerald-400">{allUsers.length}</p>
               </div>
               <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center shadow-inner">
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">AI Tasks</p>
                  <p className="text-xl md:text-2xl font-bold text-purple-400">{tasks.length}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          <div className="lg:col-span-2">
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden h-full">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                 <h2 className="text-xl font-bold flex items-center gap-2 text-white mb-6">
                   <Sparkles size={20} className="text-purple-400"/> Meeting Transcript & AI Notes
                 </h2>
                 <div className="bg-slate-950 p-5 md:p-6 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed shadow-inner font-medium text-sm md:text-[15px] h-full">
                   {summaryText.split('\n').map((line: string, i: number) => {
                     if (line.includes('**')) {
                       const parts = line.split('**');
                       return (
                         <p key={`line-${i}`} className="mb-3">
                           {parts.map((part, index) => 
                             index % 2 === 1 ? <strong key={`bold-${i}-${index}`} className="text-white bg-slate-800/80 px-1.5 py-0.5 rounded text-sm border border-slate-700">{part}</strong> : <span key={`text-${i}-${index}`}>{part}</span>
                           )}
                         </p>
                       );
                     }
                     if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                        return <li key={`list-${i}`} className="ml-4 mb-2 text-blue-300">{line.replace(/^[-*]/, '').trim()}</li>
                     }
                     return <p key={`para-${i}`} className="mb-3">{line}</p>
                   })}
                 </div>
             </div>
          </div>

          <div className="space-y-6">
             
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-6">
                   <BarChart3 size={18} className="text-emerald-400"/> Task Resolution
                </h2>
                {pieChartData.length > 0 ? (
                   <div className="h-48 w-full flex flex-col items-center">
                      <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                         <PieChart>
                            <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                               {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} itemStyle={{ color: '#fff' }}/>
                         </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-3 justify-center mt-4">
                         {pieChartData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-[11px] font-medium">
                               <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                               <span className="text-slate-300">{entry.name} <span className="text-slate-500">({entry.value})</span></span>
                            </div>
                         ))}
                      </div>
                   </div>
                ) : (
                   <div className="h-32 flex items-center justify-center text-slate-500 text-sm bg-slate-950 rounded-xl border border-slate-800/50">No tasks generated</div>
                )}
             </div>

             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                      <Users size={18} className="text-blue-400"/> Roster
                   </h2>
                   <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md">{allUsers.length} Joined</span>
                </div>
                
                <div className="space-y-3">
                   {allUsers.length > 0 ? allUsers.map((u, idx) => {
                      const isMe = Boolean(currentUser?.email && u?.email && currentUser.email === u.email);
                      
                      return (
                      <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-white uppercase shrink-0 border border-slate-700 overflow-hidden">
                            {u.profilePic ? (
                               <img src={u.profilePic} alt={u.name} className="h-full w-full object-cover" />
                            ) : (
                               u.name?.charAt(0) || 'U'
                            )}
                         </div>
                         <div className="overflow-hidden flex-1">
                            <p className="text-slate-200 font-bold text-sm flex items-center gap-2 truncate">
                              {u.name} 
                              {u.isHost && <span className="text-[9px] bg-blue-500/20 border border-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded uppercase shrink-0">Host</span>}
                              {isMe && <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded shrink-0">(You)</span>}
                            </p>
                            {isCurrentUserHost || isMe ? (
                              <p className="text-slate-500 text-xs truncate mt-0.5">{u.email}</p>
                            ) : (
                              <p className="text-slate-600 text-[10px] italic mt-0.5">Email hidden</p>
                            )}
                         </div>
                      </div>
                   )}) : (
                      <p className="text-sm text-slate-500 text-center py-4 bg-slate-950 rounded-xl border border-slate-800">No participant data</p>
                   )}
                </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
}