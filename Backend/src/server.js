const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");


const { connectDB } = require("./config/database");
const { redis, testRedisConnection } = require("./config/redis");
const { globalRateLimiter } = require("./middleware/rateLimiter");
const { startVoteConsumer, stopVoteConsumer } = require("./services/voteConsumer");
const { connectProducer } = require("./config/kafka");


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
const analyticsRoutes = require("./routes/analytics");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['polling'],
    allowUpgrades: false,
    pingTimeout: 60000,
    pingInterval: 25000,
  },
  path: '/socket.io/',
  serveClient: false,
});

app.set('io', io);

// Store connected sockets
const connectedSockets = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);
  connectedSockets.set(socket.id, { id: socket.id, time: new Date() });

  socket.on("join-poll", (pollId) => {
    try {
      const roomName = `poll-${pollId}`;
      socket.join(roomName);
      console.log(`✅ Socket ${socket.id} joined room: ${roomName}`);
      socket.emit("joined-poll", { pollId: parseInt(pollId), room: roomName });
    } catch (error) {
      console.error(`Error joining poll room:`, error);
    }
  });

  socket.on("leave-poll", (pollId) => {
    try {
      const roomName = `poll-${pollId}`;
      socket.leave(roomName);
      console.log(`❌ Socket ${socket.id} left room: ${roomName}`);
    } catch (error) {
      console.error(`Error leaving poll room:`, error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Client disconnected:", socket.id, "Reason:", reason);
    connectedSockets.delete(socket.id);
  });
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', globalRateLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/analytics", analyticsRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Polling Platform API with Redis & Kafka", 
    version: "3.0.0",
    features: {
      caching: "Redis",
      rateLimiting: "Enabled",
      realtime: "Socket.IO",
      streaming: "Kafka (Analytics)"
    }
  });
});

// Health check
app.get("/health", async (req, res) => {
  const redisStatus = await testRedisConnection();
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    redis: redisStatus ? "connected" : "disconnected",
    connections: connectedSockets.size
  });
});

// Error handling
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
    await testRedisConnection();
    
    // Start Kafka (don't fail if not available)
    try {
      await connectProducer();
      await startVoteConsumer();
      console.log('✅ Kafka services started');
    } catch (kafkaError) {
      console.warn('⚠️ Kafka not available - analytics features disabled');
      console.warn('   To enable Kafka, start it with: docker-compose up -d');
    }
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log("🚀 SERVER STARTED SUCCESSFULLY");
      console.log("=".repeat(50));
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`🗄️  Redis: Connected & Caching Enabled`);
      console.log(`⚡ Rate Limiting: Active`);
      console.log(`📊 Kafka: ${process.env.KAFKA_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
      console.log("=".repeat(50) + "\n");
    });
    
  } catch (error) {
    console.error("Failed to start server:", error);
    if (error.code === 'ECONNREFUSED') {
      console.error('Make sure PostgreSQL is running');
    }
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await stopVoteConsumer();
  await redis.quit();
  io.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

startServer();