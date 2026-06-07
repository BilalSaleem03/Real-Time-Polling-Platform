const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const { connectDB } = require("./config/database");

// Import models to establish relationships
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
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/votes", voteRoutes);

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join-poll", (pollId) => {
    socket.join(`poll-${pollId}`);
    console.log(`Client ${socket.id} joined poll ${pollId}`);
  });

  socket.on("leave-poll", (pollId) => {
    socket.leave(`poll-${pollId}`);
    console.log(`Client ${socket.id} left poll ${pollId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

app.set("io", io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const startServer = async () => {
  await connectDB();
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket ready for connections`);
  });
};

startServer();