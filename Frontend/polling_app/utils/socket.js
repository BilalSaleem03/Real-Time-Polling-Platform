import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

let socket = null;
let connectionAttempts = 0;
const maxAttempts = 3;

export const initializeSocket = () => {
  if (!socket) {
    console.log("🔌 Initializing socket connection to:", SOCKET_URL);
    
    try {
      socket = io(SOCKET_URL, {
        // Use polling only, avoid WebSocket issues
        transports: ["polling"],
        // Connection options
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        // Disable upgrades to avoid WebSocket errors
        upgrade: false,
        forceNew: true,
      });
      
      // Connection events
      socket.on("connect", () => {
        console.log("✅ Socket connected successfully! ID:", socket.id);
        connectionAttempts = 0;
      });
      
      socket.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error.message);
        
        // Try to reconnect with different transport
        if (connectionAttempts === 0 && error.message.includes('websocket')) {
          console.log("🔄 Retrying with polling transport...");
          socket.io.opts.transports = ["polling"];
          socket.connect();
          connectionAttempts++;
        }
      });
      
      socket.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected:", reason);
      });
      
      socket.on("error", (error) => {
        // Ignore WebSocket errors
        if (!error.message?.includes('websocket')) {
          console.error("Socket error:", error);
        }
      });
      
    } catch (error) {
      console.error("Failed to initialize socket:", error);
    }
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const isSocketConnected = () => {
  return socket && socket.connected;
};