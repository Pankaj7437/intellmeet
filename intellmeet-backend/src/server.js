const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

// 1. IMPORT HTTP AND SOCKET.IO
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

dotenv.config();
connectDB();

const app = express();

// 2. WRAP EXPRESS WITH THE NATIVE HTTP SERVER
const server = http.createServer(app);

// 3. INITIALIZE SOCKET.IO
const io = new Server(server, {
    cors: { 
        origin: process.env.CLIENT_URL || '*', 
        methods: ['GET', 'POST'] 
    }
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.send('API is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// 4. THE REAL-TIME LOGIC (The Two-Way Street)
io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        
        // Tell everyone else the NEW user's specific socket ID
        socket.to(roomId).emit('user-connected', socket.id);
        
        socket.on('send-message', (message) => {
            io.to(roomId).emit('receive-message', message);
        });

        socket.on('send-transcript', (text) => {
            socket.to(roomId).emit('receive-transcript', { text, sender: socket.id });
        });

        // --- MULTI-USER TARGETED SIGNALING --- //
        // Instead of broadcasting to the whole room, we route directly to 'data.target'
        socket.on('offer', (data) => {
        // Send the offer ONLY to the intended target
        socket.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('answer', (data) => {
        // Send the answer ONLY back to the original caller
        socket.to(data.target).emit('answer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, caller: socket.id });
    });
    });

    socket.on('disconnect', () => {
        console.log(`🔴 User disconnected: ${socket.id}`);
        // Optional: tell the room someone left so their video box disappears
    });
});

const PORT = process.env.PORT || 5000;

// 5. CRITICAL CHANGE: Listen with 'server', not 'app'
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT} with WebSockets enabled!`));