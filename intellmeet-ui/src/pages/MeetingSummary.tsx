import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, Calendar, ArrowLeft, Loader2 } from 'lucide-react';

export default function MeetingSummary() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
        <p className="text-xl font-bold text-slate-300">Loading AI Summary...</p>
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
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-12 font-sans overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-8 bg-slate-900 px-4 py-2 rounded-lg w-max shadow-md border border-slate-800">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div className="mb-8 border-b border-slate-800 pb-6 relative z-10">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{meeting.title || 'Meeting Summary'}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-slate-400 mt-4">
              <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                 <span className="text-blue-400">Room:</span> {meeting.roomId}
              </span>
              <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                 <Calendar size={14} className="text-emerald-400" /> {meeting.date} at {meeting.time}
              </span>
              <span className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-[10px] border border-emerald-500/20">
                 <CheckCircle size={14} /> Completed
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-400">
              <Sparkles size={22}/> AI Insights & Action Items
            </h2>
            
            <div className="bg-slate-950 p-5 md:p-6 rounded-2xl border border-purple-500/30 text-slate-300 leading-relaxed shadow-inner">
              {summaryText.split('\n').map((line: string, i: number) => {
                
                // Bold text handling with proper unique keys
                if (line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={`line-${i}`} className="mb-3">
                      {parts.map((part, index) => 
                        index % 2 === 1 ? (
                          <strong key={`bold-${i}-${index}`} className="text-white bg-slate-800 px-1 rounded">{part}</strong>
                        ) : (
                          <span key={`text-${i}-${index}`}>{part}</span>
                        )
                      )}
                    </p>
                  );
                }
                
                // Lists handling
                if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                   return <li key={`list-${i}`} className="ml-4 mb-2 text-blue-200">{line.replace(/^[-*]/, '').trim()}</li>
                }
                
                // Paragraph handling
                return <p key={`para-${i}`} className="mb-3">{line}</p>
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}