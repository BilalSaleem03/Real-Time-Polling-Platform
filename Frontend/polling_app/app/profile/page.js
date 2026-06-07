// src/app/profile/page.js (simplified version)
"use client";
import { useState, useEffect } from "react";
import { getUser, isAdmin, getTenantUsers } from "@/utils/auth";
import api from "@/utils/api";
import styles from "@/styles/Profile.module.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    
    if (isAdmin()) {
      fetchTenantUsers();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchTenantUsers = async () => {
    try {
      const response = await api.get("/auth/tenant-users");
      setTenantUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
        </div>
        <h2>{user?.name}</h2>
        <p className={styles.email}>{user?.email}</p>
        <div className={styles.badge}>
          {user?.role === "admin" ? "Admin" : "Member"}
        </div>
        <p className={styles.tenant}>Company: {user?.tenantName}</p>
      </div>

      {isAdmin() && tenantUsers.length > 0 && (
        <div className={styles.teamSection}>
          <h3>Team Members ({tenantUsers.length})</h3>
          <div className={styles.userList}>
            {tenantUsers.map((member) => (
              <div key={member.id} className={styles.userCard}>
                <div className={styles.userAvatar}>
                  {member.name?.charAt(0) || member.email?.charAt(0)}
                </div>
                <div className={styles.userInfo}>
                  <strong>{member.name || member.email}</strong>
                  <span>{member.email}</span>
                  <span className={styles.roleBadge}>{member.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}