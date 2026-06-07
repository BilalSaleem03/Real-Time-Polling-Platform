"use client";
import { useState, useEffect } from "react";
import styles from "@/styles/Navbar.module.css";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error("Error parsing user data");
      }
    }
  }, []);

  return (
    <nav className={styles.navbar}>
      <button 
        className={styles.menuBtn}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        ☰
      </button>
      
      <div className={styles.userInfo}>
        <div className={styles.userAvatar}>
          {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
        </div>
        <div className={styles.userDetails}>
          <span className={styles.userName}>{user?.name || "User"}</span>
          <span className={styles.userTenant}>{user?.tenantName || "Loading..."}</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;