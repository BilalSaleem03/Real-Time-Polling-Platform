"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import PollCard from "@/components/PollCard";
import styles from "@/styles/Dashboard.module.css";

export default function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const response = await api.get("/polls");
      setPolls(response.data.polls);
    } catch (error) {
      console.error("Error fetching polls:", error);
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
      <div className={styles.header}>
        <h1>Your Polls</h1>
        <button onClick={() => router.push("/create-poll")} className={styles.createBtn}>
          + Create New Poll
        </button>
      </div>

      {polls.length === 0 ? (
        <div className={styles.empty}>
          <img src="/svgs/poll.svg" alt="No polls" />
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