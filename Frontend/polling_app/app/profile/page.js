"use client";
import { useState, useEffect } from "react";
import api from "@/utils/api";
import styles from "@/styles/Profile.module.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
    fetchTenantUsers();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

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
          {user?.name?.charAt(0) || "U"}
        </div>
        <h2>{user?.name}</h2>
        <p className={styles.email}>{user?.email}</p>
        <div className={styles.badge}>{user?.role === "admin" ? "Admin" : "Member"}</div>
        <p className={styles.tenant}>Company: {user?.tenantName}</p>
      </div>

      {user?.role === "admin" && (
        <div className={styles.teamSection}>
          <h3>Team Members</h3>
          <div className={styles.userList}>
            {tenantUsers.map((member) => (
              <div key={member.id} className={styles.userCard}>
                <div className={styles.userAvatar}>
                  {member.name?.charAt(0) || member.email.charAt(0)}
                </div>
                <div className={styles.userInfo}>
                  <strong>{member.name}</strong>
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