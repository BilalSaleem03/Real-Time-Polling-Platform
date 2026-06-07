"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SocketProvider from "@/components/SocketProvider";
import "./globals.css";

export default function RootLayout({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPublicPage = pathname === "/" || isAuthPage;

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("user");
      
      if (token && user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        
        // Redirect to login if not on auth page
        if (!isPublicPage) {
          router.push("/login");
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, [pathname, router, isPublicPage]);

  if (loading) {
    return (
      <html lang="en">
        <body>
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "100vh" 
          }}>
            <div className="spinner"></div>
          </div>
        </body>
      </html>
    );
  }

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