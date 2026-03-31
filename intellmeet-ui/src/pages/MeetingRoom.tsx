import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare } from 'lucide-react';

const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  
  // Multi-user peer management
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  
  const [liveCaption, setLiveCaption] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true; 
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    setSocket(newSocket);

    const setupMedia = async () => {
      let stream: MediaStream | null = null;
      try {
        // Step 1: Attempt full media access
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        console.warn("Initial audio/video request failed. Attempting fallback...", err);
        try {
          // Step 2: Fallback to video only if mic is blocked/missing
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (isMounted) setIsMuted(true);
        } catch (vErr) {
          console.error("Total hardware failure:", vErr);
          if (isMounted) alert("Could not access camera. Please check browser permissions.");
          return;
        }
      }

      if (!isMounted || !stream) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }

      setMyStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      newSocket.emit('join-room', roomId);

      // Targeted Signaling Handlers for Multi-User Support
      newSocket.on('user-connected', async (newUserId) => {
        const pc = createPeerConnection(newUserId, newSocket, stream!);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        newSocket.emit('offer', { target: newUserId, sdp: offer });
      });

      newSocket.on('offer', async (data: { caller: string, sdp: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(data.caller, newSocket, stream!);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('answer', { target: data.caller, sdp: answer });
      });

      newSocket.on('answer', async (data: { caller: string, sdp: RTCSessionDescriptionInit }) => {
        const pc = peersRef.current[data.caller];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      newSocket.on('ice-candidate', async (data: { caller: string, candidate: RTCIceCandidateInit }) => {
        const pc = peersRef.current[data.caller];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
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
  }, [roomId]);

  // Clean up tracks on exit
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

  // AI Transcription Engine
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

  // SMART TOGGLE: Attempts to rescue mic if it was initially missing
  const toggleMute = async () => {
    if (myStream && myStream.getAudioTracks().length > 0) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    } else {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = audioStream.getAudioTracks()[0];
        if (myStream) {
          myStream.addTrack(newTrack);
          Object.values(peersRef.current).forEach(pc => {
            pc.addTrack(newTrack, myStream);
          });
          setIsMuted(false);
        }
      } catch (err) {
        alert("Microphone still unavailable. Check system sound settings.");
      }
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
      socket.emit('send-message', chatInput);
      setChatInput('');
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col md:flex-row overflow-hidden font-sans">
      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all ${showChat ? 'md:w-3/4' : 'w-full'}`}>
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-lg md:text-xl font-bold tracking-tight">Room: {roomId}</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowChat(!showChat)} className="md:hidden bg-slate-700 p-2 rounded-lg hover:bg-slate-600 transition">
              <MessageSquare size={20} />
            </button>
            <button 
              onClick={() => { myStream?.getTracks().forEach(t => t.stop()); navigate('/dashboard'); }} 
              className="bg-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition shadow-lg"
            >
              Leave Meeting
            </button>
          </div>
        </div>
        
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 overflow-y-auto pb-24">
          {/* Local Feed */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-2xl min-h-[220px]">
            <video ref={myVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="h-20 w-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-400">Me</div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold border border-slate-700">You</div>
          </div>

          {/* Remote Feeds */}
          {Object.entries(remoteStreams).map(([id, stream]) => (
            <div key={id} className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-2xl min-h-[220px]">
               <video autoPlay playsInline className="h-full w-full object-cover" ref={v => { if (v) v.srcObject = stream }} />
               <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold border border-slate-700">Participant</div>
            </div>
          ))}
        </div>

        {/* AI Transcription Overlay */}
        {liveCaption && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[80%]">
            <p className="text-white text-sm md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}

        {/* Meeting Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-lg px-8 py-4 rounded-3xl flex gap-6 z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700">
          <button onClick={toggleMute} className={`p-4 rounded-full transition-all duration-200 transform hover:scale-110 ${isMuted ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button onClick={toggleVideo} className={`p-4 rounded-full transition-all duration-200 transform hover:scale-110 ${isVideoOff ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
          <button className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 text-blue-400 transition-all transform hover:scale-110">
            <MonitorUp size={22} />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className={`${showChat ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-30`}>
        <div className="p-5 border-b border-slate-800 font-bold text-slate-300 tracking-wide uppercase text-xs">Meeting Chat</div>
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className="bg-slate-800/50 p-3 rounded-2xl text-sm break-words border border-slate-700/50 text-slate-200">
              {m}
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-5 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-slate-200" 
              placeholder="Type a message..." 
            />
            <button type="submit" className="bg-blue-600 px-5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 active:scale-95">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}