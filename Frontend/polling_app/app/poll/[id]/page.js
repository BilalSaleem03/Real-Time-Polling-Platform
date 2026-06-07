"use client";
import { useState, useEffect, useRef } from "react";
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
  const [analytics, setAnalytics] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (id) {
      fetchPollData();
      fetchPollAnalytics();
      setupSocket();
    }
    
    return () => {
      if (socketRef.current && id) {
        socketRef.current.emit("leave-poll", id);
      }
    };
  }, [id]);

  const setupSocket = () => {
    try {
      const socket = initializeSocket();
      socketRef.current = socket;
      
      socket.on("connect", () => {
        setSocketConnected(true);
        socket.emit("join-poll", id);
      });
      
      socket.on("joined-poll", (data) => {
        console.log("Joined poll room:", data);
      });
      
      socket.on("vote-update", (data) => {
        if (data.pollId === parseInt(id)) {
          setResults(data.results);
          // Refresh analytics after vote
          fetchPollAnalytics();
        }
      });
      
      socket.on("connect_error", (error) => {
        setSocketConnected(false);
      });
      
      if (socket.connected) {
        setSocketConnected(true);
        socket.emit("join-poll", id);
      }
    } catch (error) {
      console.error("Error setting up socket:", error);
    }
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

  const fetchPollAnalytics = async () => {
    try {
      const response = await api.get(`/analytics/poll/${id}`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
      await fetchPollAnalytics();
      
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
        <p>Loading poll...</p>
      </div>
    );
  }

  if (!poll) return null;

  const totalVotes = results.reduce((sum, count) => sum + parseInt(count), 0);

  return (
    <div className={styles.container}>
      <div className={styles.pollCard}>
        <h1>{poll.title}</h1>
        {poll.description && <p className={styles.description}>{poll.description}</p>}
        
        <div className={styles.stats}>
          <span>📊 {totalVotes} total votes</span>
          <span>📅 Created {new Date(poll.created_at).toLocaleDateString()}</span>
          <span className={socketConnected ? styles.connected : styles.disconnected}>
            {socketConnected ? "🔴 Live Updates" : "⚫ Offline"}
          </span>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div className={styles.analyticsInfo}>
            <div className={styles.analyticsCard}>
              <span>⚡ Vote Velocity</span>
              <strong>{analytics.recentVelocity || 0} votes/min</strong>
            </div>
            <div className={styles.analyticsCard}>
              <span>🏆 Global Rank</span>
              <strong>#{analytics.leaderboardRank || 'N/A'}</strong>
            </div>
            <div className={styles.analyticsCard}>
              <span>📊 Total Votes</span>
              <strong>{analytics.totalVotes || totalVotes}</strong>
            </div>
          </div>
        )}

        <div className={styles.voteSection}>
          <h3>{hasVoted ? "Vote Results" : "Cast Your Vote"}</h3>
          
          {hasVoted && results.length > 0 && (
            <VoteChart options={poll.options} results={results} />
          )}
          
          <div className={styles.optionsList}>
            {poll.options.map((option, index) => {
              const voteCount = results[index] || 0;
              const percentage = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0;
              
              return (
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
                      {voteCount} votes ({percentage}%)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          {hasVoted && (
            <div className={styles.votedMessage}>
              ✅ You voted for: {poll.options[userVote]}
            </div>
          )}
          
          {!socketConnected && (
            <div className={styles.warning}>
              ⚠️ Real-time updates disconnected. Results will update on refresh.
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