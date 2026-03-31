import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';
import Register from './pages/Register';
import MeetingRoom from './pages/MeetingRoom';

// A simple protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// A temporary Dashboard to test the login success
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const handleCreateMeeting = () => {
    // Generate a random 6-character room code
    const newRoomId = Math.random().toString(36).substring(2, 8);
    navigate(`/meeting/${newRoomId}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/meeting/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold text-blue-500">IntellMeet Dashboard</h1>
          <button onClick={logout} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Meeting Card */}
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 flex flex-col items-center text-center justify-center">
            <h2 className="text-2xl font-bold mb-4">Start a New Meeting</h2>
            <p className="text-slate-400 mb-8">Generate a secure room and invite your team.</p>
            <button 
              onClick={handleCreateMeeting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              New Meeting
            </button>
          </div>

          {/* Join Meeting Card */}
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 flex flex-col items-center text-center justify-center">
            <h2 className="text-2xl font-bold mb-4">Join Existing Meeting</h2>
            <p className="text-slate-400 mb-8">Enter the room code provided by the host.</p>
            <form onSubmit={handleJoinMeeting} className="w-full flex gap-2">
              <input 
                type="text" 
                placeholder="Enter Room Code (e.g., a1b2c3)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                required
              />
              <button 
                type="submit" 
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-3 rounded-lg transition-colors"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Route */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/meeting/:roomId" 
          element={
            <ProtectedRoute>
              <MeetingRoom />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;