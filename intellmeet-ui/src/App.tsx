import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';
import Register from './pages/Register';
import MeetingRoom from './pages/MeetingRoom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// A simple protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state: any) => state.token);
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Fully Responsive Dashboard Component
const Dashboard = () => {
  const logout = useAuthStore((state: any) => state.logout);
  const user = useAuthStore((state: any) => state.user); // Fetching user details
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const handleCreateMeeting = () => {
    // Generate a random 7-character room code
    const newRoomId = Math.random().toString(36).substring(2, 9);
    navigate(`/meeting/${newRoomId}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/meeting/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col items-center">
      
      {/* Header Area */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 md:mb-12 mt-2 md:mt-4">
        <h1 className="text-xl md:text-3xl font-bold text-blue-500 tracking-tight">
          IntellMeet
        </h1>
        <div className="flex items-center gap-3 md:gap-4">
          {/* Shows the user's real name from MongoDB (hidden on very small phones to save space) */}
          <span className="hidden sm:block font-medium text-slate-300">
            Hello, {user?.name || user?.firstName || 'User'}
          </span>
          <button 
            onClick={logout} 
            className="bg-slate-800 hover:bg-slate-700 px-3 py-2 md:px-4 md:py-2 rounded-lg transition-colors text-sm md:text-base border border-slate-700"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Actions - RESPONSIVE GRID */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        
        {/* Create Meeting Card */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl border border-slate-700 shadow-xl flex flex-col items-center text-center justify-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-4">Start a New Meeting</h2>
          <p className="text-slate-400 mb-6 md:mb-8 text-sm md:text-base">Generate a secure room and invite your team.</p>
          <button 
            onClick={handleCreateMeeting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-4 rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-sm md:text-base"
          >
            New Meeting
          </button>
        </div>

        {/* Join Meeting Card */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl border border-slate-700 shadow-xl flex flex-col items-center text-center justify-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-4">Join Existing Meeting</h2>
          <p className="text-slate-400 mb-6 md:mb-8 text-sm md:text-base">Enter the room code provided by the host.</p>
          
          {/* Responsive Form: Stacks vertically on phones, side-by-side on larger screens */}
          <form onSubmit={handleJoinMeeting} className="w-full flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Enter Room Code (e.g., a1b2c3)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full sm:flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 text-sm md:text-base"
              required
            />
            <button 
              type="submit" 
              className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm md:text-base"
            >
              Join
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

// Main App Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
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