const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env")
});
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");


const { connectDB } = require("./config/database");

// Import models
const Tenant = require("./models/Tenant");
const { User } = require("./models/User");
const Poll = require("./models/Poll");
const Vote = require("./models/Vote");

// Define model relationships
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(User, { foreignKey: 'tenant_id' });

Poll.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Poll.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Poll.hasMany(Vote, { foreignKey: 'poll_id', as: 'votes' });

Vote.belongsTo(Poll, { foreignKey: 'poll_id' });
Vote.belongsTo(User, { foreignKey: 'user_id' });

// Import routes
const authRoutes = require("./routes/auth");
const pollRoutes = require("./routes/poll");
const voteRoutes = require("./routes/vote");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with proper configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    wsEngine: 'ws'
  },
  path: '/socket.io/',
  serveClient: false,
  // Suppress specific error messages
  logger: {
    error: (err) => {
      // Only log real errors, not WebSocket upgrade messages
      if (err.message && !err.message.includes('websocket error')) {
        console.error('Socket error:', err);
      }
    }
  }
});

// Make io available to routes
app.set('io', io);

// Store connected sockets for debugging
const connectedSockets = new Map();

// Socket.IO connection handling with error handling
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);
  connectedSockets.set(socket.id, { id: socket.id, time: new Date() });

  // Handle socket errors silently
  socket.on("error", (error) => {
    if (error.message && !error.message.includes('websocket error')) {
      console.error(`Socket ${socket.id} error:`, error);
    }
  });

  // Join a specific poll room
  socket.on("join-poll", (pollId) => {
    try {
      const roomName = `poll-${pollId}`;
      socket.join(roomName);
      console.log(`✅ Socket ${socket.id} joined room: ${roomName}`);
      
      // Send confirmation back to client
      socket.emit("joined-poll", { 
        pollId: parseInt(pollId), 
        room: roomName,
        message: "Successfully joined poll room"
      });
      
      // Get room size and emit to client
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      socket.emit("room-info", { pollId: parseInt(pollId), listeners: roomSize });
      
    } catch (error) {
      console.error(`Error joining poll room:`, error);
      socket.emit("error", { message: "Failed to join poll room" });
    }
  });

  // Leave poll room
  socket.on("leave-poll", (pollId) => {
    try {
      const roomName = `poll-${pollId}`;
      socket.leave(roomName);
      console.log(`❌ Socket ${socket.id} left room: ${roomName}`);
    } catch (error) {
      console.error(`Error leaving poll room:`, error);
    }
  });

  // Test ping-pong for connection testing
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });

  // Get room info
  socket.on("get-room-info", (pollId) => {
    try {
      const roomName = `poll-${pollId}`;
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      socket.emit("room-info", { pollId: parseInt(pollId), listeners: roomSize });
    } catch (error) {
      console.error(`Error getting room info:`, error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Client disconnected:", socket.id, "Reason:", reason);
    connectedSockets.delete(socket.id);
  });
});

// Handle upgrade errors globally
io.engine.on("connection_error", (err) => {
  if (err.message && !err.message.includes('websocket error')) {
    console.log("Connection error:", err.message);
  }
});

// Debug: Log room sizes periodically (every 60 seconds)
setInterval(() => {
  if (connectedSockets.size > 0) {
    console.log("\n📊 Socket Status:");
    console.log(`   Active connections: ${connectedSockets.size}`);
    io.sockets.adapter.rooms.forEach((value, key) => {
      if (key.startsWith('poll-')) {
        console.log(`   Room ${key}: ${value.size} clients`);
      }
    });
  }
}, 60000);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/votes", voteRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Polling Platform API", 
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      polls: "/api/polls",
      votes: "/api/votes"
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    connections: connectedSockets.size
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log("🚀 SERVER STARTED SUCCESSFULLY");
      console.log("=".repeat(50));
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`📊 Socket.IO ready for connections`);
      console.log("=".repeat(50) + "\n");
    });
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  io.close(() => {
    console.log('Socket.IO closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});

startServer();