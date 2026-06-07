"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SocketProvider from "@/components/SocketProvider";
import "./globals.css";

export default function RootLayout({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, [pathname]);

  return (
    <html lang="en">
      <body>
        <SocketProvider>
          {!isAuthPage && isAuthenticated ? (
            <div className="app-layout">
              <Sidebar />
              <div className="main-content">
                <Navbar />
                <div className="page-container">{children}</div>
              </div>
            </div>
          ) : (
            <div className="auth-layout">{children}</div>
          )}
        </SocketProvider>
      </body>
    </html>
  );
}