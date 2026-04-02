const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit'); // Naya Security Feature

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);

// 1. DATABASE CONNECTION
connectDB();

// 2. MIDDLEWARES & SECURITY
app.use(helmet({ contentSecurityPolicy: false }));

// 🔥 PRODUCTION CORS FIX: Ab sirf aapki Vercel website hi allow hogi
app.use(cors({
  origin: ["https://intellmeet.vercel.app", "http://localhost:5173"], 
  credentials: true
}));

app.use(express.json());

// 🔥 RATE LIMITING (Brute Force Protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute
    max: 15, // Max 15 attempts
    message: { message: "Too many requests from this IP, please try again after 15 minutes" }
});
// Sirf Login/Register par limit lagayenge
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);


// 3. ROUTES
app.get("/", (req, res) => res.send("IntellMeet API is Running Successfully 🚀"));
app.get('/api/health', (req, res) => res.send('API is healthy...'));

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// 4. SOCKET.IO (Production Config)
const io = new Server(server, {
  cors: { 
    origin: ["https://intellmeet.vercel.app", "http://localhost:5173"], 
    methods: ["GET", "POST"] 
  }
});

io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', { userId: socket.id, userName });
        
        socket.on('send-message', (message) => io.to(roomId).emit('receive-message', message));
        socket.on('media-status-change', (data) => socket.to(data.roomId).emit('peer-media-status', { userId: socket.id, isMuted: data.isMuted, isVideoOff: data.isVideoOff }));
        socket.on('request-media-status', (targetUserId) => socket.to(targetUserId).emit('request-media-status-from', socket.id));
        socket.on('send-transcript', (text) => socket.to(roomId).emit('receive-transcript', { text, sender: socket.id }));
        socket.on('offer', (data) => socket.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id, userName: data.userName }));
        socket.on('answer', (data) => socket.to(data.target).emit('answer', { sdp: data.sdp, caller: socket.id, userName: data.userName }));
        socket.on('speaking-status', (data) => socket.to(data.roomId).emit('peer-speaking', { userId: socket.id, isSpeaking: data.isSpeaking }));
        socket.on('toggle-raise-hand', (data) => socket.to(data.roomId).emit('peer-raised-hand', { userId: socket.id, userName: data.userName, isRaised: data.isRaised }));
        socket.on('send-reaction', (data) => socket.to(data.roomId).emit('peer-reaction', { userId: socket.id, emoji: data.emoji }));
        socket.on('ice-candidate', (data) => socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, caller: socket.id }));
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (roomId !== socket.id) socket.to(roomId).emit('user-disconnected', socket.id);
        });
    });
});

// 5. START SERVER (Production ke liye '0.0.0.0' wapas lagana zaroori hai Render k liye)
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});