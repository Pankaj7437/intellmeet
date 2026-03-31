const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

// Relative paths based on your provided folder structure
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);

// 1. DATABASE CONNECTION
connectDB();

// 2. MIDDLEWARES
// Helmet helps secure your app by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier development/testing of WebRTC
}));

// CORS must allow your Vercel production URL for Login/Register to work
app.use(cors({
  origin: ["https://intellmeet.vercel.app", "http://localhost:5173"],
  credentials: true
}));

// Body Parser is required to read registration/login JSON data
app.use(express.json());

// 3. HEALTH CHECK & LANDING ROUTES
// This prevents the "Cannot GET /" error on Render
app.get("/", (req, res) => {
  res.send("IntellMeet API is Running Successfully 🚀");
});

app.get('/api/health', (req, res) => res.send('API is healthy...'));

// 4. API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// 5. INITIALIZE SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: ["https://intellmeet.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// 6. REAL-TIME LOGIC
io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // Notify others in the room
        socket.to(roomId).emit('user-connected', socket.id);
        
        socket.on('send-message', (message) => {
            io.to(roomId).emit('receive-message', message);
        });

        socket.on('send-transcript', (text) => {
            socket.to(roomId).emit('receive-transcript', { text, sender: socket.id });
        });

        // MULTI-USER TARGETED SIGNALING for WebRTC
        socket.on('offer', (data) => {
            socket.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
        });

        socket.on('answer', (data) => {
            socket.to(data.target).emit('answer', { sdp: data.sdp, caller: socket.id });
        });

        socket.on('ice-candidate', (data) => {
            socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, caller: socket.id });
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔴 User disconnected: ${socket.id}`);
    });
});

// 7. START SERVER
// Using 0.0.0.0 is mandatory for Render/Cloud deployments
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});