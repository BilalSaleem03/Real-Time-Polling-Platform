"use client";
import { useState, useEffect } from "react";
import styles from "@/styles/Navbar.module.css";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
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
          {user?.name?.charAt(0) || "U"}
        </div>
        <div className={styles.userDetails}>
          <span className={styles.userName}>{user?.name}</span>
          <span className={styles.userTenant}>{user?.tenantName}</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;