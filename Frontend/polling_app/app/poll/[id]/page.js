"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket, initializeSocket } from "@/utils/socket";
import api from "@/utils/api";
import VoteChart from "@/components/VoteChart";
import styles from "@/styles/PollDetail.module.css";

export default function PollDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPollData();
      setupSocket();
    }
  }, [id]);

  const setupSocket = () => {
    const socket = initializeSocket();
    
    socket.on("connect", () => {
      console.log("Socket connected");
      socket.emit("join-poll", id);
    });

    socket.on("vote-update", (data) => {
      if (data.pollId === parseInt(id)) {
        setResults(data.results);
      }
    });

    return () => {
      socket.emit("leave-poll", id);
    };
  };

  const fetchPollData = async () => {
    try {
      const [pollRes, voteStatusRes] = await Promise.all([
        api.get(`/polls/${id}`),
        api.get(`/votes/check/${id}`)
      ]);
      
      setPoll(pollRes.data.poll);
      setResults(pollRes.data.results || new Array(pollRes.data.poll.options.length).fill(0));
      setHasVoted(voteStatusRes.data.hasVoted);
      setUserVote(voteStatusRes.data.voteOption);
    } catch (error) {
      console.error("Error fetching poll:", error);
      if (error.response?.status === 404) {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (optionIndex) => {
    if (hasVoted) {
      alert("You have already voted in this poll");
      return;
    }

    setVoting(true);
    try {
      const response = await api.post("/votes", {
        pollId: parseInt(id),
        optionIndex
      });
      
      setResults(response.data.results);
      setHasVoted(true);
      setUserVote(optionIndex);
    } catch (error) {
      console.error("Error voting:", error);
      alert(error.response?.data?.error || "Failed to submit vote");
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!poll) return null;

  const totalVotes = results.reduce((sum, count) => sum + count, 0);

  return (
    <div className={styles.container}>
      <div className={styles.pollCard}>
        <h1>{poll.title}</h1>
        {poll.description && <p className={styles.description}>{poll.description}</p>}
        
        <div className={styles.stats}>
          <span>📊 {totalVotes} total votes</span>
          <span>📅 Created {new Date(poll.created_at).toLocaleDateString()}</span>
        </div>

        <div className={styles.voteSection}>
          <h3>{hasVoted ? "Vote Results" : "Cast Your Vote"}</h3>
          
          {hasVoted && <VoteChart options={poll.options} results={results} />}
          
          <div className={styles.optionsList}>
            {poll.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleVote(index)}
                disabled={hasVoted || voting}
                className={`${styles.optionBtn} ${
                  userVote === index ? styles.selected : ""
                }`}
              >
                <span className={styles.optionText}>{option}</span>
                {hasVoted && (
                  <span className={styles.voteCount}>
                    {results[index]} votes ({totalVotes > 0 ? ((results[index] / totalVotes) * 100).toFixed(1) : 0}%)
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {hasVoted && (
            <div className={styles.votedMessage}>
              ✅ You voted for: {poll.options[userVote]}
            </div>
          )}
        </div>

        <button onClick={() => router.back()} className={styles.backBtn}>
          ← Back to Polls
        </button>
      </div>
    </div>
  );
}