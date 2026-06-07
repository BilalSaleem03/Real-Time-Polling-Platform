"use client";
import { useState, useEffect } from "react";
import { getUser, isAdmin, getTenantUsers } from "@/utils/auth";
import api from "@/utils/api";
import styles from "@/styles/Profile.module.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    
    fetchUserStats();
    
    if (isAdmin()) {
      fetchTenantUsers();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await api.get("/analytics/user/stats");
      setUserStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // Don't show error, just set default stats
      setUserStats({
        totalVotes: 0,
        currentStreak: 0,
        longestStreak: 0
      });
    }
  };

  const fetchTenantUsers = async () => {
    try {
      const response = await api.get("/auth/tenant-users");
      setTenantUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      if (error.response?.status !== 403) {
        setError("Failed to load team members");
      }
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

      {/* User Stats Section */}
      {userStats && (
        <div className={styles.streakSection}>
          <h3>Your Activity</h3>
          <div className={styles.streakStats}>
            <div className={styles.streakCard}>
              <span>🔥 Current Streak</span>
              <strong>{userStats.currentStreak || 0} days</strong>
            </div>
            <div className={styles.streakCard}>
              <span>🏆 Longest Streak</span>
              <strong>{userStats.longestStreak || 0} days</strong>
            </div>
            <div className={styles.streakCard}>
              <span>🗳️ Total Votes</span>
              <strong>{userStats.totalVotes || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Team Members - Admin Only */}
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
      
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}