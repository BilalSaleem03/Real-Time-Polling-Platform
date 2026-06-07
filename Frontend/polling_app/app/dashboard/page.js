"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import PollCard from "@/components/PollCard";
import styles from "@/styles/Dashboard.module.css";

export default function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check if token exists before fetching
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchPolls();
  }, [router]);

  const fetchPolls = async () => {
    try {
      setError("");
      console.log("Fetching polls...");
      const response = await api.get("/polls");
      console.log("Polls fetched:", response.data.polls);
      setPolls(response.data.polls || []);
    } catch (error) {
      console.error("Error fetching polls:", error);
      if (error.response?.status === 401) {
        // Token invalid or expired
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
      } else {
        setError("Failed to load polls. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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
        <button onClick={fetchPolls} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Your Polls</h1>
        <button onClick={() => router.push("/create-poll")} className={styles.createBtn}>
          + Create New Poll
        </button>
      </div>

      {polls.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <h3>No polls yet</h3>
          <p>Create your first poll to get started</p>
          <button onClick={() => router.push("/create-poll")} className={styles.emptyBtn}>
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