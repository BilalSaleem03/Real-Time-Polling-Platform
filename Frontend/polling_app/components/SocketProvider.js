"use client";
import { useEffect } from "react";
import { initializeSocket, disconnectSocket } from "@/utils/socket";

const SocketProvider = ({ children }) => {
  useEffect(() => {
    initializeSocket();
    
    return () => {
      disconnectSocket();
    };
  }, []);

  return children;
};

export default SocketProvider;