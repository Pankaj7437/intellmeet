import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore'; 

const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// FIX 1: Safely catch AbortErrors so they don't flood the console
const VideoPlayer = memo(({ stream, name, isMuted = false }: { stream: MediaStream; name: string; isMuted?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Ignore AbortError caused by React rapid re-mounting
          if (error.name !== 'AbortError') {
            console.error('Video play error:', error);
          }
        });
      }
    }
  }, [stream]);

  return (
    <div className="bg-black h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted={isMuted} className="h-full w-full object-contain" />
      <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/90 backdrop-blur px-2 py-1 md:px-3 rounded-full text-[10px] md:text-xs font-semibold border border-slate-700 text-white truncate max-w-[90%] shadow-lg z-10">
        {name}
      </div>
    </div>
  );
});

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false); 
  
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  
  const [peerNames, setPeerNames] = useState<{ [key: string]: string }>({});
  const [liveCaption, setLiveCaption] = useState('');
  const recognitionRef = useRef<any>(null);

  // Lock in the user's name so it doesn't change mid-render
  const user = useAuthStore((state: any) => state.user);
  const [userName] = useState(() => user?.name || user?.username || user?.firstName || `Guest-${Math.floor(Math.random() * 1000)}`);

  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; 
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    setSocket(newSocket);

    const setupMedia = async () => {
      let stream: MediaStream;
      
      // FIX 2: Graceful hardware fallback (allows users without webcams to still join)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        console.warn("Initial audio/video request failed. Attempting fallback...");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (isMounted) setIsMuted(true);
        } catch (vErr) {
          console.warn("No hardware found. Joining as Viewer.");
          stream = new MediaStream(); // Creates an empty stream so the app doesn't crash
          if (isMounted) {
            setIsMuted(true);
            setIsVideoOff(true);
          }
        }
      }

      if (!isMounted || !stream) return;

      setMyStream(stream);
      newSocket.emit('join-room', { roomId, userName });

      newSocket.on('user-connected', async ({ userId, userName: incomingName }) => {
        setPeerNames(prev => ({ ...prev, [userId]: incomingName }));
        
        const pc = createPeerConnection(userId, newSocket, stream!);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        newSocket.emit('offer', { target: userId, sdp: offer, userName }); 
      });

      newSocket.on('offer', async (data: { caller: string, sdp: RTCSessionDescriptionInit, userName: string }) => {
        setPeerNames(prev => ({ ...prev, [data.caller]: data.userName }));
        
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

      newSocket.on('user-disconnected', (userId: string) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].close();
          delete peersRef.current[userId];
        }
        setRemoteStreams(prev => {
          const updatedStreams = { ...prev };
          delete updatedStreams[userId];
          return updatedStreams;
        });
        setPeerNames(prev => {
          const updatedNames = { ...prev };
          delete updatedNames[userId];
          return updatedNames;
        });
        
        // Use functional state update to prevent dependency cycle
        setPinnedUserId(prev => prev === userId ? null : prev);
      });
    };

    setupMedia();

    newSocket.on('receive-message', (msg: string) => setMessages(prev => [...prev, msg]));
    
    newSocket.on('receive-transcript', (data: { text: string }) => {
      setLiveCaption(data.text);
      setTimeout(() => setLiveCaption(''), 3000);
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
    
  // FIX 3: Removed `pinnedUserId` from this array so clicking doesn't destroy the WebRTC connection!
  }, [roomId, userName]); 

  useEffect(() => {
    return () => {
      myStream?.getTracks().forEach(t => t.stop());
    };
  }, [myStream]);

  const createPeerConnection = (peerId: string, currentSocket: Socket, stream: MediaStream) => {
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        currentSocket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };

    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    return pc;
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !isMuted && myStream?.getAudioTracks().length) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            socket?.emit('send-transcript', transcript);
            setLiveCaption(transcript);
            setTimeout(() => setLiveCaption(''), 3000);
          }
        }
      };

      recognition.onend = () => { if (!isMuted) try { recognition.start(); } catch (e) {} };
      try { recognition.start(); } catch (e) {}
    }
    return () => recognitionRef.current?.stop();
  }, [isMuted, socket, myStream]);

  const toggleMute = async () => {
    if (myStream && myStream.getAudioTracks().length > 0) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (myStream?.getVideoTracks()[0]) {
      const videoTrack = myStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('send-message', `${userName}: ${chatInput}`);
      setChatInput('');
    }
  };

  const handleVideoClick = (id: string) => {
    setPinnedUserId(prev => prev === id ? null : id);
  };

  const getGridClasses = (count: number) => {
    if (count === 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'; 
    if (count <= 4) return 'grid-cols-2 grid-rows-2';  
    if (count <= 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';   
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-3 grid-rows-4 md:grid-cols-4 md:grid-rows-3';    
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex overflow-hidden font-sans relative">
      
      {/* MAIN MEETING AREA */}
      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all duration-300 ${showChat ? 'md:mr-80' : 'w-full'}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-2 md:mb-4 px-2 z-10">
          <h2 className="text-base md:text-xl font-bold tracking-tight bg-slate-900/50 backdrop-blur px-3 py-1 rounded-lg">Room: {roomId}</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowChat(!showChat)} className="md:hidden bg-slate-700 p-2 rounded-lg hover:bg-slate-600 transition shadow-lg">
              <MessageSquare size={18} />
            </button>
            <button 
              onClick={() => { myStream?.getTracks().forEach(t => t.stop()); navigate('/dashboard'); }} 
              className="bg-red-600 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold hover:bg-red-700 transition shadow-lg"
            >
              Leave
            </button>
          </div>
        </div>
        
        {/* Responsive Video Layout Area */}
        <div className={`flex-1 flex overflow-hidden pb-20 md:pb-24 px-1 md:px-2 gap-2 md:gap-4 min-h-0 ${pinnedUserId ? 'flex-col md:flex-row' : 'flex-col'}`}>
          
          {/* Pinned/Enlarged Video */}
          {pinnedUserId && remoteStreams[pinnedUserId] && (
            <div 
              className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl border-2 border-blue-500 shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden bg-black" 
              onClick={() => handleVideoClick(pinnedUserId)}
            >
              <VideoPlayer stream={remoteStreams[pinnedUserId]} name={peerNames[pinnedUserId] || "Participant"} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to shrink</div>
            </div>
          )}

          {/* Dynamic Grid of participants */}
          <div className={`
            grid gap-2 md:gap-4 w-full h-full min-h-0
            ${pinnedUserId 
                ? 'grid-cols-3 md:grid-cols-1 w-full md:w-48 lg:w-64 h-[25%] md:h-full flex-shrink-0 overflow-y-auto content-start' 
                : `${getGridClasses(Object.keys(remoteStreams).length)} flex-1`
            } 
          `}>
            {Object.entries(remoteStreams).map(([id, stream]) => {
              if (id === pinnedUserId) return null;
              return (
                <div key={id} onClick={() => handleVideoClick(id)} className={`cursor-pointer transition-transform hover:scale-[1.02] w-full relative rounded-2xl shadow-lg border border-slate-800 flex items-center justify-center bg-black min-h-0 min-w-0 overflow-hidden ${pinnedUserId ? 'aspect-video md:aspect-auto md:h-32 lg:h-40' : 'h-full'}`}>
                  <VideoPlayer stream={stream} name={peerNames[id] || "Participant"} />
                </div>
              );
            })}
            
            {/* Show an empty state if alone and no one is pinned */}
            {Object.keys(remoteStreams).length === 0 && !pinnedUserId && (
               <div className="col-span-full h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800/50 min-h-[200px]">
                  <MonitorUp size={48} className="mb-4 opacity-20 md:opacity-40" />
                  <p className="text-sm md:text-base text-center px-4">Waiting for others to join...</p>
               </div>
            )}
          </div>
        </div>

        {/* FLOATING LOCAL VIDEO (PiP) */}
        <div className="absolute bottom-24 right-4 md:bottom-28 md:right-8 w-24 h-36 md:w-48 md:h-32 bg-slate-950 rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl z-20 transition-all">
          {myStream && !isVideoOff && myStream.getVideoTracks().length > 0 ? (
             <VideoPlayer stream={myStream} name={`${userName} (You)`} isMuted={true} />
          ) : (
             <div className="h-full w-full flex items-center justify-center bg-slate-900 relative">
                <div className="h-10 w-10 md:h-16 md:w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-400 text-xl md:text-3xl uppercase">
                  {userName ? userName.charAt(0) : 'U'}
                </div>
                <div className="absolute bottom-2 left-2 bg-slate-900/90 px-2 py-1 rounded-full text-[10px] font-semibold truncate max-w-[85%]">
                  {userName} (You)
                </div>
             </div>
          )}
        </div>

        {/* AI Transcription Overlay */}
        {liveCaption && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[90%] md:max-w-[80%]">
            <p className="text-white text-xs md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}

        {/* Meeting Controls */}
        <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-lg px-4 py-2 md:px-8 md:py-4 rounded-full flex gap-3 md:gap-6 z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 w-max">
          <button onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button onClick={toggleVideo} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isVideoOff ? 'bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>
          <button className="p-3 md:p-4 rounded-full bg-slate-700 hover:bg-slate-600 text-blue-400 hidden md:block transition-all">
            <MonitorUp size={20} />
          </button>
          <button onClick={() => setShowChat(!showChat)} className="p-3 md:p-4 rounded-full bg-slate-700 hover:bg-slate-600 hidden md:block transition-all">
            <MessageSquare size={20} />
          </button>
        </div>
      </div>

      {/* CHAT SIDEBAR / MOBILE OVERLAY */}
      <div className={`
        ${showChat ? 'translate-x-0' : 'translate-x-full'} 
        fixed top-0 right-0 h-full w-full md:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out
      `}>
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
          <span className="font-bold text-slate-300 tracking-wide uppercase text-xs">Meeting Chat</span>
          <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
          {messages.length === 0 ? (
             <div className="text-center text-slate-500 text-sm mt-10">No messages yet. Say hello!</div>
          ) : (
            messages.map((m, i) => {
              const isMe = m.startsWith(`${userName}:`);
              return (
                <div key={i} className={`p-3 rounded-2xl text-sm break-words border ${isMe ? 'bg-blue-900/30 border-blue-800/50 text-blue-100 self-end' : 'bg-slate-800/50 border-slate-700/50 text-slate-200 self-start'} max-w-[90%]`}>
                  {m}
                </div>
              )
            })
          )}
        </div>
        
        <form onSubmit={sendMessage} className="p-4 border-t border-slate-800 bg-slate-950 pb-safe">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-slate-200" 
              placeholder="Type a message..." 
            />
            <button type="submit" className="bg-blue-600 px-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 active:scale-95 text-sm">
              Send
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}