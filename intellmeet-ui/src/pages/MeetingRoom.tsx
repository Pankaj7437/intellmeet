import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, X, Users, Pin, Hand, Smile, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore'; 

const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const VideoPlayer = memo(({ stream, name, isMuted = false, isVideoOff = false, isLocal = false, isSpeaking = false, isHandRaised = false }: { stream: MediaStream; name: string; isMuted?: boolean; isVideoOff?: boolean; isLocal?: boolean; isSpeaking?: boolean; isHandRaised?: boolean }) => {
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
    <div className={`bg-black h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden group border-2 shadow-lg transition-all ${isSpeaking ? 'border-blue-500 shadow-blue-500/20 shadow-xl' : 'border-slate-800'}`}>
      {isVideoOff ? (
        <div className={`h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center font-bold text-slate-300 text-3xl uppercase shadow-xl border-4 transition-all ${isSpeaking ? 'bg-slate-700 border-blue-500 shadow-blue-500/40' : 'bg-slate-800 border-slate-700'}`}>
          {name ? name.charAt(0) : 'U'}
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted={isLocal || isMuted} className="h-full w-full object-contain" />
      )}
      
      {isHandRaised && (
        <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg z-20 animate-bounce">
          <Hand size={16} className="text-white" />
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/90 backdrop-blur pl-2 pr-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium border border-slate-700 text-white flex items-center gap-1.5 shadow-lg z-10">
        {isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} className={isSpeaking ? "text-blue-400" : "text-emerald-500"} />}
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isMuted, setIsMuted] = useState(localStorage.getItem('intellmeet_isMuted') === 'true');
  const [isVideoOff, setIsVideoOff] = useState(localStorage.getItem('intellmeet_isVideoOff') === 'true');
  
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [key: string]: string }>({});
  
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: { isMuted: boolean, isVideoOff: boolean } }>({});
  const [speakingPeers, setSpeakingPeers] = useState<{ [key: string]: boolean }>({});
  
  const [layoutMode, setLayoutMode] = useState<'grid' | 'sidebar'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  const [liveCaption, setLiveCaption] = useState('');
  const [toastNotification, setToastNotification] = useState<{msg: string, sender: string} | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const screenSocketRef = useRef<Socket | null>(null);
  const screenPeersRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<{ [key: string]: boolean }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number, emoji: string, left: number }[]>([]);

  const user = useAuthStore((state: any) => state.user);
  const [userName] = useState(() => user?.name || user?.username || user?.firstName || `Guest-${Math.floor(Math.random() * 1000)}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showSidebar, activeTab]);

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

      if (initialMute && stream.getAudioTracks().length > 0) stream.getAudioTracks()[0].enabled = false;
      if (initialVideoOff && stream.getVideoTracks().length > 0) stream.getVideoTracks()[0].enabled = false;

      setMyStream(stream);
      newSocket.emit('join-room', { roomId, userName });
      setupAudioMeter(stream); // Removed unused 'local' type parameter
      
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

      newSocket.on('peer-speaking', (data: { userId: string, isSpeaking: boolean }) => {
        setSpeakingPeers(prev => ({ ...prev, [data.userId]: data.isSpeaking }));
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
        setSpeakingPeers(prev => { const sp = { ...prev }; delete sp[userId]; return sp; });
        setRaisedHands(prev => { const rh = { ...prev }; delete rh[userId]; return rh; });
        setPinnedUserId(prev => prev === userId ? null : prev);
      });
    };

    setupMedia();

    newSocket.on('receive-message', (data: {text: string, sender: string}) => {
      if (!showSidebar && data.sender !== userName) {
        setToastNotification({ msg: data.text, sender: data.sender });
        setTimeout(() => setToastNotification(null), 4000);
      }
      setMessages(prev => [...prev, `${data.sender}: ${data.text}`]);
    });
    
    newSocket.on('receive-transcript', (data: { text: string }) => {
      setLiveCaption(data.text);
      setTimeout(() => setLiveCaption(''), 4000);
    });

    newSocket.on('peer-raised-hand', (data: { userId: string, userName: string, isRaised: boolean }) => {
      setRaisedHands(prev => ({ ...prev, [data.userId]: data.isRaised }));
      if (data.isRaised) {
        setToastNotification({ msg: "Raised their hand ✋", sender: data.userName });
        setTimeout(() => setToastNotification(null), 4000);
      }
    });

    newSocket.on('peer-reaction', (data: { userId: string, emoji: string }) => {
      triggerFloatingEmoji(data.emoji);
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
      Object.values(peersRef.current).forEach(pc => pc.close());
      if (audioContextRef.current) audioContextRef.current.close();

      if (screenSocketRef.current) screenSocketRef.current.disconnect();
      Object.values(screenPeersRef.current).forEach(pc => pc.close());
      setLocalScreenStream(prev => { prev?.getTracks().forEach(t => t.stop()); return null; });
    };
  }, [roomId, userName]); 

  const triggerFloatingEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.max(10, Math.min(90, 50 + (Math.random() * 40 - 20))); 
    setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
    
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 3000);
  };

  const sendReaction = (emoji: string) => {
    triggerFloatingEmoji(emoji);
    socket?.emit('send-reaction', { roomId, emoji });
    setShowEmojiPicker(false);
  };

  const toggleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    setRaisedHands(prev => ({ ...prev, 'local': newState }));
    socket?.emit('toggle-raise-hand', { roomId, userName, isRaised: newState });
  };

  // Removed unused 'type' parameter
  const setupAudioMeter = (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const audioContext = audioContextRef.current;
    
    try {
        const microphone = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speakingTimeout: any;

        const checkAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            
            if (average > 15) { 
                if (!speakingPeers['local']) {
                    setSpeakingPeers(prev => ({...prev, 'local': true}));
                    socket?.emit('speaking-status', { roomId, isSpeaking: true });
                }
                clearTimeout(speakingTimeout);
                speakingTimeout = setTimeout(() => {
                    setSpeakingPeers(prev => ({...prev, 'local': false}));
                    socket?.emit('speaking-status', { roomId, isSpeaking: false });
                }, 1000); 
            }
            requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
    } catch(e) { console.warn("Audio Context error:", e); }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; 
      recognitionRef.current = recognition;
    }

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          socket?.emit('send-transcript', transcript);
          setLiveCaption(transcript);
          setTimeout(() => setLiveCaption(''), 4000);
        }
      }
    };

    recognition.onend = () => { if (!isMuted && recognitionRef.current && captionsEnabled) { try { recognitionRef.current.start(); } catch (e) {} } };
    
    if (!isMuted && captionsEnabled) { try { recognition.start(); } catch (e) {} } 
    else { try { recognition.stop(); } catch (e) {} }

    return () => { recognition.onresult = null; recognition.onend = null; };
  }, [isMuted, socket, captionsEnabled]); 

  const createPeerConnection = (peerId: string, currentSocket: Socket, stream: MediaStream) => {
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peersRef.current[peerId] = pc;
    pc.onicecandidate = (event) => { if (event.candidate) currentSocket.emit('ice-candidate', { target: peerId, candidate: event.candidate }); };
    pc.ontrack = (event) => { setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] })); };

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

  const toggleScreenShare = async () => {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
      if (screenSocketRef.current) {
        screenSocketRef.current.disconnect();
        screenSocketRef.current = null;
      }
      Object.values(screenPeersRef.current).forEach(pc => pc.close());
      screenPeersRef.current = {};
      setPinnedUserId(prev => prev === 'local-screen' ? null : prev);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setLocalScreenStream(stream);

        stream.getVideoTracks()[0].onended = () => {
           setLocalScreenStream(prev => {
              if (prev) {
                 prev.getTracks().forEach(t => t.stop());
                 if (screenSocketRef.current) { screenSocketRef.current.disconnect(); screenSocketRef.current = null; }
                 Object.values(screenPeersRef.current).forEach(pc => pc.close());
                 screenPeersRef.current = {};
                 setPinnedUserId(p => p === 'local-screen' ? null : p);
              }
              return null;
           });
        };

        const sSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
        screenSocketRef.current = sSocket;
        const screenName = `${userName}'s Presentation`;

        sSocket.emit('join-room', { roomId, userName: screenName });
        setTimeout(() => { sSocket.emit('media-status-change', { roomId, isMuted: false, isVideoOff: false }); }, 1000);

        sSocket.on('user-connected', async ({ userId }) => {
          const pc = new RTCPeerConnection(peerConnectionConfig);
          screenPeersRef.current[userId] = pc;
          pc.onicecandidate = (e) => { if (e.candidate) sSocket.emit('ice-candidate', { target: userId, candidate: e.candidate }); };
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sSocket.emit('offer', { target: userId, sdp: offer, userName: screenName });
        });

        sSocket.on('offer', async (data) => {
          const pc = new RTCPeerConnection(peerConnectionConfig);
          screenPeersRef.current[data.caller] = pc;
          pc.onicecandidate = (e) => { if (e.candidate) sSocket.emit('ice-candidate', { target: data.caller, candidate: e.candidate }); };
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sSocket.emit('answer', { target: data.caller, sdp: answer, userName: screenName });
        });

        sSocket.on('answer', async (data) => {
          const pc = screenPeersRef.current[data.caller];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        });

        sSocket.on('ice-candidate', async (data) => {
          const pc = screenPeersRef.current[data.caller];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        });

        setPinnedUserId('local-screen');

      } catch (err) {
        console.error("Screen share error:", err);
      }
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('send-message', { roomId, text: chatInput, sender: userName });
      setChatInput('');
    }
  };

  const allPeerIds = Object.keys(peerNames);
  
  const sortedPeerIds = [...allPeerIds].sort((a, b) => {
    if (raisedHands[a] && !raisedHands[b]) return -1;
    if (!raisedHands[a] && raisedHands[b]) return 1;
    if (speakingPeers[a] && !speakingPeers[b]) return -1;
    if (!speakingPeers[a] && speakingPeers[b]) return 1;
    const aVideoOn = !peerStatus[a]?.isVideoOff;
    const bVideoOn = !peerStatus[b]?.isVideoOff;
    if (aVideoOn && !bVideoOn) return -1;
    if (!aVideoOn && bVideoOn) return 1;
    return (peerNames[a] || '').localeCompare(peerNames[b] || '');
  });

  const activePeers = sortedPeerIds.filter(id => !peerStatus[id]?.isVideoOff);
  const hiddenPeers = sortedPeerIds.filter(id => peerStatus[id]?.isVideoOff);
  
  if (localScreenStream) {
     activePeers.unshift('local-screen');
  }
  
  const groupedPeersLimit = hiddenPeers.length > 3 ? 2 : hiddenPeers.length;
  const renderedHiddenPeers = hiddenPeers.slice(0, groupedPeersLimit);
  const remainingHiddenCount = hiddenPeers.length - groupedPeersLimit;

  const totalTiles = activePeers.length + renderedHiddenPeers.length + (remainingHiddenCount > 0 ? 1 : 0);

  const getGridClasses = (count: number) => {
    if (count <= 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'; 
    if (count <= 4) return 'grid-cols-2 grid-rows-2';  
    if (count <= 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';   
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-3 grid-rows-4 md:grid-cols-4 md:grid-rows-3';    
  };

  let autoPinned = null;
  if (layoutMode === 'sidebar') {
     autoPinned = sortedPeerIds.length > 0 ? sortedPeerIds[0] : 'local';
  } else if (sortedPeerIds.length > 0 && speakingPeers[sortedPeerIds[0]]) {
     autoPinned = sortedPeerIds[0];
  }
  
  const displayPinnedId = pinnedUserId || autoPinned;

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-900 text-white flex overflow-hidden font-sans">
      
      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
           <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl relative">
              <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={24}/> Meeting Settings</h2>
              
              <div className="space-y-4">
                 <div className="bg-slate-800 p-4 rounded-xl flex justify-between items-center">
                    <div>
                       <p className="text-sm text-slate-200 font-semibold">Live Captions</p>
                       <p className="text-xs text-slate-400">Auto-transcribe speech to text</p>
                    </div>
                    <button onClick={() => setCaptionsEnabled(!captionsEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${captionsEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}>
                       <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${captionsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
                    </button>
                 </div>

                 <div className="bg-slate-800 p-4 rounded-xl">
                    <p className="text-sm text-slate-200 font-semibold mb-1">Layout Mode</p>
                    <p className="text-xs text-slate-400 mb-3">Choose how videos are displayed</p>
                    <select 
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm w-full outline-none focus:border-blue-500 transition-colors"
                      value={layoutMode}
                      onChange={(e) => setLayoutMode(e.target.value as 'grid' | 'sidebar')}
                    >
                      <option value="grid">Auto Grid</option>
                      <option value="sidebar">Sidebar Priority</option>
                    </select>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all duration-300 ${showSidebar ? 'md:mr-80' : 'w-full'} h-full`}>
        
        {toastNotification && (
           <div className="absolute top-4 right-4 md:top-8 md:right-8 bg-slate-800 border-l-4 border-blue-500 shadow-2xl px-4 py-3 rounded-lg z-50 flex flex-col animate-in slide-in-from-top-4 fade-in duration-300 max-w-xs">
              <span className="text-xs text-blue-400 font-bold uppercase">{toastNotification.sender}</span>
              <span className="text-sm text-slate-200 truncate">{toastNotification.msg}</span>
           </div>
        )}

        <div className="flex justify-between items-center mb-2 md:mb-4 px-2 z-10">
          <h2 className="text-base md:text-xl font-bold tracking-tight bg-slate-900/50 backdrop-blur px-3 py-1 rounded-lg">Room: {roomId}</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowSettingsModal(true)} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition shadow-lg text-slate-300">
              <Settings size={18} />
            </button>
            <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }} className="md:hidden bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition shadow-lg">
              <Users size={18} />
            </button>
            <button onClick={() => { myStream?.getTracks().forEach(t => t.stop()); navigate('/dashboard'); }} className="bg-red-600 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold hover:bg-red-700 transition shadow-lg">
              Leave
            </button>
          </div>
        </div>
        
        <div className={`flex-1 flex overflow-hidden pb-20 md:pb-24 px-1 md:px-2 gap-2 md:gap-4 min-h-0 ${displayPinnedId ? 'flex-col md:flex-row' : 'flex-col'}`}>
          
          {displayPinnedId === 'local' ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} isMuted={true} isVideoOff={isVideoOff} isLocal={true} isSpeaking={speakingPeers['local']} isHandRaised={isHandRaised} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to unpin</div>
            </div>
          ) : displayPinnedId === 'local-screen' && localScreenStream ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={localScreenStream} name={`${userName}'s Presentation`} isMuted={true} isVideoOff={false} isLocal={true} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to unpin</div>
            </div>
          ) : (displayPinnedId && peerNames[displayPinnedId]) ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={remoteStreams[displayPinnedId] || new MediaStream()} name={peerNames[displayPinnedId] || "Participant"} isMuted={peerStatus[displayPinnedId]?.isMuted} isVideoOff={peerStatus[displayPinnedId]?.isVideoOff} isSpeaking={speakingPeers[displayPinnedId]} isHandRaised={raisedHands[displayPinnedId]} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">{pinnedUserId ? "Click to unpin" : "Main Stage"}</div>
            </div>
          ) : null}

          <div className={`grid gap-2 md:gap-4 min-h-0 custom-scrollbar ${displayPinnedId ? 'grid-cols-3 md:grid-cols-1 w-full md:w-64 h-[25%] md:h-full flex-shrink-0 overflow-y-auto content-start auto-rows-[100px] md:auto-rows-[140px]' : `${getGridClasses(totalTiles)} w-full h-full flex-1`}`}>
            
            {activePeers.map(id => {
              if (id === displayPinnedId) return null;
              if (id === 'local-screen') {
                 return (
                    <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                      <VideoPlayer stream={localScreenStream!} name={`${userName}'s Presentation`} isMuted={true} isVideoOff={false} isLocal={true} />
                    </div>
                 );
              }
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} isMuted={peerStatus[id]?.isMuted} isVideoOff={false} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {renderedHiddenPeers.map(id => {
              if (id === displayPinnedId) return null;
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} isMuted={peerStatus[id]?.isMuted} isVideoOff={true} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {remainingHiddenCount > 0 && !displayPinnedId && (
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
            
            {allPeerIds.length === 0 && !localScreenStream && (
               <div className="col-span-full h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800/50 min-h-[200px]">
                  <MonitorUp size={48} className="mb-4 opacity-20 md:opacity-40" />
                  <p className="text-sm md:text-base text-center px-4">Waiting for others to join...</p>
               </div>
            )}
          </div>
        </div>

        {displayPinnedId !== 'local' && (
          <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-28 md:right-8 w-24 h-36 md:w-48 md:h-32 bg-slate-950 rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl z-20 transition-all">
             <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} isMuted={isMuted} isVideoOff={isVideoOff} isLocal={true} isSpeaking={speakingPeers['local']} isHandRaised={isHandRaised} />
          </div>
        )}

        {liveCaption && captionsEnabled && (
          <div className="absolute bottom-[calc(8rem+env(safe-area-inset-bottom))] md:bottom-36 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[90%] md:max-w-[70%] pointer-events-none">
            <p className="text-white text-xs md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}

        {/* BOTTOM CONTROLS BAR */}
        <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-lg px-4 py-2 md:px-6 md:py-3 rounded-full flex gap-2 md:gap-4 z-40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 w-max items-center">
          
          <button onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button onClick={toggleVideo} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>

          <button onClick={toggleRaiseHand} className={`p-3 md:p-4 rounded-full transition-all duration-200 ${isHandRaised ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Raise Hand">
            <Hand size={20} />
          </button>

          <div className="relative">
             <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 md:p-4 rounded-full transition-all duration-200 bg-slate-700 hover:bg-slate-600 text-slate-300" title="Reactions">
               <Smile size={20} />
             </button>
             {showEmojiPicker && (
               <div className="absolute bottom-[120%] left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-full px-3 py-2 flex gap-2 shadow-2xl">
                  {['👍', '👏', '❤️', '😂', '😲', '🎉'].map(emoji => (
                     <button key={emoji} onClick={() => sendReaction(emoji)} className="text-xl hover:scale-125 transition-transform">{emoji}</button>
                  ))}
               </div>
             )}
          </div>

          <button onClick={toggleScreenShare} className={`p-3 md:p-4 rounded-full transition-all duration-200 hidden md:block ${localScreenStream ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Present Screen">
            <MonitorUp size={20} />
          </button>

          <div className="w-px h-8 bg-slate-700 mx-1 md:mx-2 hidden sm:block"></div>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('chat'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block ${showSidebar && activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <MessageSquare size={20} />
          </button>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block ${showSidebar && activeTab === 'participants' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <Users size={20} />
          </button>
        </div>
      </div>

      <div className={`${showSidebar ? 'translate-x-0' : 'translate-x-full'} fixed top-0 right-0 h-[100dvh] w-full md:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out`}>
        
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
                messages.map((m, i) => {
                  const isMe = m.startsWith(`${userName}:`);
                  return (
                  <div key={i} className={`p-3 rounded-2xl text-sm break-words border ${isMe ? 'bg-blue-900/30 border-blue-800/50 text-blue-100 self-end' : 'bg-slate-800/50 border-slate-700/50 text-slate-200 self-start'} max-w-[90%]`}>
                    {m}
                  </div>
                )})
              )}
              {/* Dummy div to scroll into view */}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-slate-800 bg-slate-950 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 text-white" placeholder="Message..." />
                <button type="submit" className="bg-blue-600 px-4 rounded-xl font-bold hover:bg-blue-700 text-sm transition-all">Send</button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'participants' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
             <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl mb-2 border border-slate-800">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg relative">
                     {userName.charAt(0)}
                     {speakingPeers['local'] && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                   </div>
                   <span className="font-semibold text-sm truncate max-w-[100px]">{userName} (You)</span>
                </div>
                <div className="flex gap-1 items-center">
                   {isHandRaised && <Hand size={14} className="text-blue-400 mr-1 animate-bounce" />}
                   {isMuted ? <MicOff size={16} className="text-red-500" /> : <Mic size={16} className="text-emerald-500" />}
                   {isVideoOff ? <VideoOff size={16} className="text-red-500 ml-1" /> : <VideoIcon size={16} className="text-blue-400 ml-1" />}
                   <div className="w-px h-4 bg-slate-700 mx-1"></div>
                   <button onClick={() => setPinnedUserId(pinnedUserId === 'local' ? null : 'local')} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors" title={pinnedUserId === 'local' ? "Unpin" : "Pin to screen"}>
                      <Pin size={16} className={pinnedUserId === 'local' ? "text-blue-400" : "text-slate-400"} />
                   </button>
                </div>
             </div>

             {sortedPeerIds.map(id => (
                <div key={id} className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${speakingPeers[id] ? 'bg-blue-900/20 border-blue-800/50' : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700'}`}>
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-lg text-slate-300 relative">
                        {(peerNames[id] || 'P').charAt(0)}
                        {speakingPeers[id] && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                     </div>
                     <span className={`font-medium text-sm truncate max-w-[100px] ${speakingPeers[id] ? 'text-blue-200' : 'text-slate-200'}`}>{peerNames[id] || "Participant"}</span>
                  </div>
                  <div className="flex gap-1 items-center">
                     {raisedHands[id] && <Hand size={14} className="text-blue-400 mr-1 animate-bounce" />}
                     {peerStatus[id]?.isMuted ? <MicOff size={14} className="text-red-500/80" /> : <Mic size={14} className="text-emerald-500/80" />}
                     {peerStatus[id]?.isVideoOff ? <VideoOff size={14} className="text-red-500/80 ml-1" /> : <VideoIcon size={14} className="text-blue-400/80 ml-1" />}
                     <div className="w-px h-4 bg-slate-700 mx-1"></div>
                     <button onClick={() => setPinnedUserId(pinnedUserId === id ? null : id)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors" title={pinnedUserId === id ? "Unpin" : "Pin to screen"}>
                        <Pin size={16} className={pinnedUserId === id ? "text-blue-400" : "text-slate-400"} />
                     </button>
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>

      {/* FLOATING EMOJIS LAYER (RENDERED AT THE END OF MAIN WRAPPER) */}
      <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
        {floatingEmojis.map(emoji => (
           <div 
             key={emoji.id} 
             className="absolute bottom-24 text-4xl" 
             style={{ left: `${emoji.left}%`, animation: 'floatUp 3s ease-out forwards' }}
           >
             {emoji.emoji}
           </div>
        ))}
      </div>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { transform: translateY(-50px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-300px) scale(1); opacity: 0; }
        }
      `}</style>

    </div>
  );
}