"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import PollCard from "@/components/PollCard";
import styles from "@/styles/Dashboard.module.css";

export default function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchPolls = useCallback(async (forceRefresh = false) => {
    try {
      setError("");
      if (!forceRefresh) setLoading(true);
      else setRefreshing(true);
      
      console.log("Fetching polls, forceRefresh:", forceRefresh);
      const url = forceRefresh ? "/polls?refresh=true" : "/polls";
      const response = await api.get(url);
      
      console.log("Polls fetched:", response.data.polls.length);
      setPolls(response.data.polls || []);
    } catch (error) {
      console.error("Error fetching polls:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
      } else {
        setError("Failed to load polls. Please try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPolls();
    
    // Set up interval to refresh polls every 30 seconds
    const interval = setInterval(() => {
      fetchPolls(true); // Silent refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPolls]);

  const handleManualRefresh = () => {
    fetchPolls(true);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading polls...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{error}</p>
        <button onClick={handleManualRefresh} className={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Your Polls</h1>
        <div className={styles.headerButtons}>
          <button 
            onClick={handleManualRefresh} 
            className={styles.refreshBtn}
            disabled={refreshing}
          >
            {refreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
          </button>
          <button 
            onClick={() => router.push("/create-poll")} 
            className={styles.createBtn}
          >
            + Create New Poll
          </button>
        </div>
      </div>

      {polls.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <h3>No polls yet</h3>
          <p>Create your first poll to get started</p>
          <button 
            onClick={() => router.push("/create-poll")} 
            className={styles.emptyBtn}
          >
            Create Poll
          </button>
        </div>
      ) : (
        <div className={styles.pollGrid}>
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}
    </div>
  );
}