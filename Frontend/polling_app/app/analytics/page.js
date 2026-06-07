"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import styles from "@/styles/Analytics.module.css";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState({ global: [], tenant: [] });
  const [userStats, setUserStats] = useState(null);
  const [tenantStats, setTenantStats] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [leaderboardRes, userStatsRes, tenantStatsRes] = await Promise.all([
        api.get("/analytics/leaderboard"),
        api.get("/analytics/user/stats"),
        api.get("/analytics/tenant")
      ]);

      setLeaderboard(leaderboardRes.data);
      setUserStats(userStatsRes.data.stats);
      setTenantStats(tenantStatsRes.data.analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
      <h1>Analytics Dashboard</h1>
      
      {/* User Stats Card */}
      {userStats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🗳️</div>
            <div className={styles.statValue}>{userStats.totalVotes || 0}</div>
            <div className={styles.statLabel}>Total Votes Cast</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔥</div>
            <div className={styles.statValue}>{userStats.currentStreak || 0}</div>
            <div className={styles.statLabel}>Current Streak</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏆</div>
            <div className={styles.statValue}>{userStats.longestStreak || 0}</div>
            <div className={styles.statLabel}>Longest Streak</div>
          </div>
        </div>
      )}

      {/* Tenant Stats */}
      {tenantStats && (
        <div className={styles.tenantSection}>
          <h2>Company Overview</h2>
          <div className={styles.tenantStats}>
            <div>
              <strong>{(tenantStats.totalVotes || 0).toLocaleString()}</strong>
              <span>Total Company Votes</span>
            </div>
            <div>
              <strong>{tenantStats.activeUsers || 0}</strong>
              <span>Active Users</span>
            </div>
            <div>
              <strong>{tenantStats.activePolls || 0}</strong>
              <span>Active Polls</span>
            </div>
            <div>
              <strong>{tenantStats.todayVotes || 0}</strong>
              <span>Votes Today</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard */}
      <div className={styles.leaderboardSection}>
        <h2>🏆 Top Polls - Global Leaderboard</h2>
        <div className={styles.leaderboard}>
          {leaderboard.global?.map((poll, index) => (
            <div 
              key={poll.pollId} 
              className={styles.leaderboardItem}
              onClick={() => router.push(`/poll/${poll.pollId}`)}
            >
              <span className={styles.rank}>#{index + 1}</span>
              <span className={styles.pollId}>Poll #{poll.pollId}</span>
              <span className={styles.votes}>{poll.votes} votes</span>
            </div>
          ))}
          {(!leaderboard.global || leaderboard.global.length === 0) && (
            <div className={styles.empty}>No polls in leaderboard yet. Be the first!</div>
          )}
        </div>
      </div>

      {/* Tenant Leaderboard */}
      <div className={styles.leaderboardSection}>
        <h2>🏢 Top Polls in Your Company</h2>
        <div className={styles.leaderboard}>
          {leaderboard.tenant?.map((poll, index) => (
            <div 
              key={poll.pollId} 
              className={styles.leaderboardItem}
              onClick={() => router.push(`/poll/${poll.pollId}`)}
            >
              <span className={styles.rank}>#{index + 1}</span>
              <span className={styles.pollId}>Poll #{poll.pollId}</span>
              <span className={styles.votes}>{poll.votes} votes</span>
            </div>
          ))}
          {(!leaderboard.tenant || leaderboard.tenant.length === 0) && (
            <div className={styles.empty}>No polls in company leaderboard yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}