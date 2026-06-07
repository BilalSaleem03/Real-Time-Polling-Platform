"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket, initializeSocket, testSocketConnection } from "@/utils/socket";
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
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (id) {
      fetchPollData();
      setupSocket();
    }
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current && id) {
        console.log("Cleaning up: leaving poll room", id);
        socketRef.current.emit("leave-poll", id);
      }
    };
  }, [id]);

  const setupSocket = () => {
    try {
      // Initialize socket connection
      const socket = initializeSocket();
      socketRef.current = socket;
      
      // Remove existing listeners to avoid duplicates
      socket.off("connect");
      socket.off("vote-update");
      socket.off("joined-poll");
      
      // Handle connection
      socket.on("connect", () => {
        console.log("✅ Socket connected, joining poll room:", id);
        setSocketConnected(true);
        socket.emit("join-poll", id);
        
        // Test ping
        socket.emit("ping");
      });
      
      // Handle join confirmation
      socket.on("joined-poll", (data) => {
        console.log("✅ Successfully joined:", data);
      });
      
      // Handle vote updates
      socket.on("vote-update", (data) => {
        console.log("📡 Received vote-update:", data);
        if (data.pollId === parseInt(id)) {
          console.log("Updating results:", data.results);
          setResults(data.results);
        }
      });
      
      // Handle pong response
      socket.on("pong", () => {
        console.log("🏓 Pong received, connection is alive");
      });
      
      // Handle connection errors
      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setSocketConnected(false);
      });
      
      // Check if already connected
      if (socket.connected) {
        console.log("Socket already connected, joining room:", id);
        socket.emit("join-poll", id);
        setSocketConnected(true);
      }
      
    } catch (error) {
      console.error("Error setting up socket:", error);
    }
  };

  const fetchPollData = async () => {
    try {
      console.log("Fetching poll data for ID:", id);
      const [pollRes, voteStatusRes] = await Promise.all([
        api.get(`/polls/${id}`),
        api.get(`/votes/check/${id}`)
      ]);
      
      console.log("Poll data:", pollRes.data);
      console.log("Vote status:", voteStatusRes.data);
      
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
    console.log("Submitting vote for option:", optionIndex);
    
    try {
      const response = await api.post("/votes", {
        pollId: parseInt(id),
        optionIndex
      });
      
      console.log("Vote response:", response.data);
      setResults(response.data.results);
      setHasVoted(true);
      setUserVote(optionIndex);
      
      // The socket will update other clients, but we already updated this one
      console.log("Vote submitted successfully!");
      
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

  const totalVotes = results.reduce((sum, count) => sum + count, 0);

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