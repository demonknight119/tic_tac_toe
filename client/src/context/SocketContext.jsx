import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      console.log("Creating socket connection for user:", user.username);
      const newSocket = io("http://localhost:5000", {
        forceNew: true,
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("Socket connected:", newSocket.id);
        setConnected(true);
        const token = localStorage.getItem("token");
        if (token) {
          console.log("Authenticating socket...");
          newSocket.emit("authenticate", token);
        }
      });

      newSocket.on("authenticated", (data) => {
        console.log("Socket authentication result:", data);
      });

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected");
        setConnected(false);
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      setSocket(newSocket);

      return () => {
        console.log("Cleaning up socket connection");
        newSocket.close();
      };
    } else {
      // Clean up socket when user logs out
      if (socket) {
        console.log("User logged out, closing socket");
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [user]);

  const value = {
    socket,
    connected,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
