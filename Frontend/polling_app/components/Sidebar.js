"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "@/styles/Sidebar.module.css";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { path: "/dashboard", name: "Dashboard", icon: "dashboard.svg" },
    { path: "/create-poll", name: "Create Poll", icon: "create-poll.svg" },
    { path: "/profile", name: "Profile", icon: "profile.svg" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/svgs/logo.svg" alt="Logo" className={styles.logoIcon} />
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
            <img src={`/svgs/${item.icon}`} alt={item.name} className={styles.icon} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <button onClick={handleLogout} className={styles.logoutBtn}>
        <img src="/svgs/logout.svg" alt="Logout" className={styles.icon} />
        <span>Logout</span>
      </button>
    </div>
  );
};

export default Sidebar;