import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, X, Users, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '../store/authStore'; 

const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const VideoPlayer = memo(({ stream, name, isMuted = false, isVideoOff = false, isLocal = false }: { stream: MediaStream; name: string; isMuted?: boolean; isVideoOff?: boolean; isLocal?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream && stream.getTracks().length > 0) {
      videoElement.srcObject = stream;
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') console.error('Video play error:', error);
        });
      }
    }
  }, [stream, isVideoOff]);

  return (
    <div className="bg-black h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden group border border-slate-800 shadow-lg">
      {isVideoOff ? (
        <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 text-3xl uppercase shadow-xl">
          {name ? name.charAt(0) : 'U'}
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted={isLocal || isMuted} className="h-full w-full object-contain" />
      )}
      
      <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/90 backdrop-blur pl-2 pr-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium border border-slate-700 text-white flex items-center gap-1.5 shadow-lg z-10">
        {isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} className="text-emerald-500" />}
        <span className="truncate max-w-[100px] md:max-w-[150px]">{name}</span>
      </div>
    </div>
  );
});

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [showSidebar, setShowSidebar] = useState(false); 
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [messages, setMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isMuted, setIsMuted] = useState(localStorage.getItem('intellmeet_isMuted') === 'true');
  const [isVideoOff, setIsVideoOff] = useState(localStorage.getItem('intellmeet_isVideoOff') === 'true');
  
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [key: string]: string }>({});
  
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: { isMuted: boolean, isVideoOff: boolean } }>({});
  
  const [layoutMode, setLayoutMode] = useState<'grid' | 'sidebar'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);

  // Live Caption Variables
  const [liveCaption, setLiveCaption] = useState('');
  const recognitionRef = useRef<any>(null);

  const user = useAuthStore((state: any) => state.user);
  const [userName] = useState(() => user?.name || user?.username || user?.firstName || `Guest-${Math.floor(Math.random() * 1000)}`);

  useEffect(() => {
    let isMounted = true; 
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    setSocket(newSocket);

    const setupMedia = async () => {
      let stream: MediaStream;
      let initialMute = localStorage.getItem('intellmeet_isMuted') === 'true';
      let initialVideoOff = localStorage.getItem('intellmeet_isVideoOff') === 'true';

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        console.warn("Initial hardware request failed. Fallback to audio only...");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          initialVideoOff = true;
          if (isMounted) setIsVideoOff(true);
        } catch (vErr) {
          stream = new MediaStream(); 
          initialMute = true;
          initialVideoOff = true;
          if (isMounted) { setIsMuted(true); setIsVideoOff(true); }
        }
      }

      if (!isMounted || !stream) return;

      if (initialMute && stream.getAudioTracks().length > 0) {
        stream.getAudioTracks()[0].enabled = false;
      }
      if (initialVideoOff && stream.getVideoTracks().length > 0) {
        stream.getVideoTracks()[0].enabled = false;
      }

      setMyStream(stream);
      newSocket.emit('join-room', { roomId, userName });
      
      setTimeout(() => {
        newSocket.emit('media-status-change', { roomId, isMuted: initialMute, isVideoOff: initialVideoOff });
      }, 1000);

      newSocket.on('user-connected', async ({ userId, userName: incomingName }) => {
        setPeerNames(prev => ({ ...prev, [userId]: incomingName }));
        newSocket.emit('request-media-status', userId);
        
        const pc = createPeerConnection(userId, newSocket, stream!);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        newSocket.emit('offer', { target: userId, sdp: offer, userName }); 
      });

      newSocket.on('offer', async (data: { caller: string, sdp: RTCSessionDescriptionInit, userName: string }) => {
        setPeerNames(prev => ({ ...prev, [data.caller]: data.userName }));
        newSocket.emit('request-media-status', data.caller);
        
        const pc = createPeerConnection(data.caller, newSocket, stream!);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('answer', { target: data.caller, sdp: answer, userName }); 
      });

      newSocket.on('answer', async (data: { caller: string, sdp: RTCSessionDescriptionInit, userName: string }) => {
        setPeerNames(prev => ({ ...prev, [data.caller]: data.userName }));
        const pc = peersRef.current[data.caller];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      newSocket.on('ice-candidate', async (data: { caller: string, candidate: RTCIceCandidateInit }) => {
        const pc = peersRef.current[data.caller];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      });

      newSocket.on('peer-media-status', (data: { userId: string, isMuted: boolean, isVideoOff: boolean }) => {
        setPeerStatus(prev => ({ ...prev, [data.userId]: { isMuted: data.isMuted, isVideoOff: data.isVideoOff } }));
      });

      newSocket.on('request-media-status-from', () => {
         newSocket.emit('media-status-change', { roomId, isMuted: initialMute, isVideoOff: initialVideoOff });
      });

      newSocket.on('user-disconnected', (userId: string) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].close();
          delete peersRef.current[userId];
        }
        setRemoteStreams(prev => { const s = { ...prev }; delete s[userId]; return s; });
        setPeerNames(prev => { const n = { ...prev }; delete n[userId]; return n; });
        setPeerStatus(prev => { const st = { ...prev }; delete st[userId]; return st; });
        setPinnedUserId(prev => prev === userId ? null : prev);
      });
    };

    setupMedia();

    newSocket.on('receive-message', (msg: string) => setMessages(prev => [...prev, msg]));
    
    // Live Captions Socket Listener
    newSocket.on('receive-transcript', (data: { text: string }) => {
      setLiveCaption(data.text);
      setTimeout(() => setLiveCaption(''), 3000); // Clear after 3 seconds
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [roomId, userName]); 

  // --- NEW: Speech Recognition Logic for Live Captions ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    // Only run if the browser supports it, user is not muted, and mic stream exists
    if (SpeechRecognition && !isMuted && myStream?.getAudioTracks().length) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            // Send my voice text to others
            socket?.emit('send-transcript', transcript);
            // Show it on my own screen too
            setLiveCaption(transcript);
            setTimeout(() => setLiveCaption(''), 3000);
          }
        }
      };

      recognition.onend = () => { if (!isMuted) try { recognition.start(); } catch (e) {} };
      try { recognition.start(); } catch (e) {}
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isMuted, socket, myStream]);
  // --------------------------------------------------------

  const createPeerConnection = (peerId: string, currentSocket: Socket, stream: MediaStream) => {
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) currentSocket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };

    if (stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    return pc;
  };

  const toggleMute = () => {
    if (myStream && myStream.getAudioTracks().length > 0) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      
      const newMutedState = !audioTrack.enabled;
      setIsMuted(newMutedState);
      localStorage.setItem('intellmeet_isMuted', String(newMutedState)); 
      
      socket?.emit('media-status-change', { roomId, isMuted: newMutedState, isVideoOff });
    }
  };

  const toggleVideo = () => {
    if (myStream && myStream.getVideoTracks().length > 0) {
      const videoTrack = myStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      
      const newVideoState = !videoTrack.enabled;
      setIsVideoOff(newVideoState);
      localStorage.setItem('intellmeet_isVideoOff', String(newVideoState)); 
      
      socket?.emit('media-status-change', { roomId, isMuted, isVideoOff: newVideoState });
    }
  };

  const cycleLayout = () => {
    setLayoutMode(prev => prev === 'grid' ? 'sidebar' : 'grid');
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('send-message', `${userName}: ${chatInput}`);
      setChatInput('');
    }
  };

  const allPeerIds = Object.keys(peerNames);
  const activePeers = allPeerIds.filter(id => !peerStatus[id]?.isVideoOff);
  const hiddenPeers = allPeerIds.filter(id => peerStatus[id]?.isVideoOff);
  
  const groupedPeersLimit = hiddenPeers.length > 3 ? 2 : hiddenPeers.length;
  const renderedHiddenPeers = hiddenPeers.slice(0, groupedPeersLimit);
  const remainingHiddenCount = hiddenPeers.length - groupedPeersLimit;

  const totalTiles = activePeers.length + renderedHiddenPeers.length + (remainingHiddenCount > 0 ? 1 : 0);

  const getGridClasses = (count: number) => {
    if (layoutMode === 'sidebar') return 'grid-cols-1 md:w-64 auto-rows-[160px] overflow-y-auto content-start';
    if (count <= 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'; 
    if (count <= 4) return 'grid-cols-2 grid-rows-2';  
    if (count <= 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';   
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-3 grid-rows-4 md:grid-cols-4 md:grid-rows-3';    
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex overflow-hidden font-sans relative">
      
      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all duration-300 ${showSidebar ? 'md:mr-80' : 'w-full'}`}>
        
        <div className="flex justify-between items-center mb-2 md:mb-4 px-2 z-10">
          <h2 className="text-base md:text-xl font-bold tracking-tight bg-slate-900/50 backdrop-blur px-3 py-1 rounded-lg">Room: {roomId}</h2>
          <div className="flex gap-2">
            <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }} className="md:hidden bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition shadow-lg">
              <Users size={18} />
            </button>
            <button onClick={() => { myStream?.getTracks().forEach(t => t.stop()); navigate('/dashboard'); }} className="bg-red-600 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold hover:bg-red-700 transition shadow-lg">
              Leave
            </button>
          </div>
        </div>
        
        <div className={`flex-1 flex overflow-hidden pb-20 md:pb-24 px-1 md:px-2 gap-2 md:gap-4 min-h-0 ${pinnedUserId || layoutMode === 'sidebar' ? 'flex-col md:flex-row' : 'flex-col'}`}>
          
          {(pinnedUserId && peerNames[pinnedUserId]) && (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={remoteStreams[pinnedUserId] || new MediaStream()} name={peerNames[pinnedUserId] || "Participant"} isMuted={peerStatus[pinnedUserId]?.isMuted} isVideoOff={peerStatus[pinnedUserId]?.isVideoOff} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to shrink</div>
            </div>
          )}

          <div className={`grid gap-2 md:gap-4 w-full h-full min-h-0 ${getGridClasses(totalTiles)} ${pinnedUserId ? 'grid-cols-3 md:grid-cols-1 w-full md:w-64 h-[25%] md:h-full flex-shrink-0 overflow-y-auto content-start auto-rows-[120px] md:auto-rows-[160px]' : 'flex-1'}`}>
            
            {activePeers.map(id => {
              if (id === pinnedUserId) return null;
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} isMuted={peerStatus[id]?.isMuted} isVideoOff={false} />
                </div>
              );
            })}

            {renderedHiddenPeers.map(id => {
              if (id === pinnedUserId) return null;
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} isMuted={peerStatus[id]?.isMuted} isVideoOff={true} />
                </div>
              );
            })}

            {remainingHiddenCount > 0 && !pinnedUserId && (
              <div onClick={() => { setShowSidebar(true); setActiveTab('participants'); }} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                <div className="bg-black h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden group border border-slate-800 shadow-lg">
                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xl md:text-3xl shadow-xl group-hover:bg-slate-700 transition-colors">
                    +{remainingHiddenCount}
                  </div>
                  <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/90 backdrop-blur pl-2 pr-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium border border-slate-700 text-white flex items-center gap-1.5 shadow-lg z-10">
                    <Users size={14} className="text-blue-400" />
                    <span>Others</span>
                  </div>
                </div>
              </div>
            )}
            
            {allPeerIds.length === 0 && (
               <div className="col-span-full h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800/50 min-h-[200px]">
                  <MonitorUp size={48} className="mb-4 opacity-20 md:opacity-40" />
                  <p className="text-sm md:text-base text-center px-4">Waiting for others to join...</p>
               </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-28 md:right-8 w-24 h-36 md:w-48 md:h-32 bg-slate-950 rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl z-20 transition-all">
           <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} isMuted={isMuted} isVideoOff={isVideoOff} isLocal={true} />
        </div>

        {/* --- UI OVERLAY FOR LIVE CAPTIONS --- */}
        {liveCaption && (
          <div className="absolute bottom-32 md:bottom-36 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[90%] md:max-w-[70%] pointer-events-none">
            <p className="text-white text-xs md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}

        <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-lg px-4 py-2 md:px-6 md:py-3 rounded-full flex gap-2 md:gap-4 z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 w-max items-center">
          
          <button onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button onClick={toggleVideo} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>

          <div className="w-px h-8 bg-slate-700 mx-1 md:mx-2 hidden sm:block"></div>
          
          <button onClick={cycleLayout} className="p-3 md:p-4 rounded-full bg-slate-700 hover:bg-slate-600 text-blue-400 hidden sm:block transition-all" title="Change Layout">
            <LayoutGrid size={20} />
          </button>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('chat'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block ${showSidebar && activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <MessageSquare size={20} />
          </button>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block ${showSidebar && activeTab === 'participants' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <Users size={20} />
          </button>
        </div>
      </div>

      <div className={`${showSidebar ? 'translate-x-0' : 'translate-x-full'} fixed top-0 right-0 h-full w-full md:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out`}>
        
        <div className="flex items-center justify-between p-2 border-b border-slate-800 bg-slate-950">
          <div className="flex gap-1 w-full">
             <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Chat</button>
             <button onClick={() => setActiveTab('participants')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'participants' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>People ({Object.keys(peerNames).length + 1})</button>
          </div>
          <button onClick={() => setShowSidebar(false)} className="ml-2 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg">
            <X size={16} />
          </button>
        </div>
        
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
              {messages.length === 0 ? (
                 <div className="text-center text-slate-500 text-sm mt-10">No messages yet.</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-2xl text-sm break-words border ${m.startsWith(`${userName}:`) ? 'bg-blue-900/30 border-blue-800/50 text-blue-100 self-end' : 'bg-slate-800/50 border-slate-700/50 text-slate-200 self-start'} max-w-[90%]`}>
                    {m}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-slate-800 bg-slate-950 pb-safe">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 text-white" placeholder="Message..." />
                <button type="submit" className="bg-blue-600 px-4 rounded-xl font-bold hover:bg-blue-700 text-sm transition-all">Send</button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'participants' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
             <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl mb-2 border border-slate-800">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">{userName.charAt(0)}</div>
                   <span className="font-semibold text-sm truncate max-w-[100px]">{userName} (You)</span>
                </div>
                <div className="flex gap-2">
                   {isMuted ? <MicOff size={18} className="text-red-500" /> : <Mic size={18} className="text-emerald-500" />}
                   {isVideoOff ? <VideoOff size={18} className="text-red-500" /> : <VideoIcon size={18} className="text-blue-400" />}
                </div>
             </div>

             {Object.keys(peerNames).map(id => (
                <div key={id} className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-xl transition-colors border border-transparent hover:border-slate-700">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-lg text-slate-300">{(peerNames[id] || 'P').charAt(0)}</div>
                     <span className="font-medium text-sm text-slate-200 truncate max-w-[100px]">{peerNames[id] || "Participant"}</span>
                  </div>
                  <div className="flex gap-2">
                     {peerStatus[id]?.isMuted ? <MicOff size={16} className="text-red-500/80" /> : <Mic size={16} className="text-emerald-500/80" />}
                     {peerStatus[id]?.isVideoOff ? <VideoOff size={16} className="text-red-500/80" /> : <VideoIcon size={16} className="text-blue-400/80" />}
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>

    </div>
  );
}