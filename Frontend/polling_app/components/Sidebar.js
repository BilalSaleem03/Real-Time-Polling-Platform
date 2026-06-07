"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/styles/Sidebar.module.css";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserRole(userData.role);
      } catch (e) {
        console.error("Error parsing user data");
      }
    }
  }, []);

  const menuItems = [
    { path: "/dashboard", name: "Dashboard", icon: "📊" },
    { path: "/create-poll", name: "Create Poll", icon: "➕" },
    { path: "/profile", name: "Profile", icon: "👤" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🗳️</span>
        <span>Polling Platform</span>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.navItem} ${
              pathname === item.path ? styles.active : ""
            }`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <button onClick={handleLogout} className={styles.logoutBtn}>
        <span className={styles.icon}>🚪</span>
        <span>Logout</span>
      </button>
    </div>
  );
};

export default Sidebar;