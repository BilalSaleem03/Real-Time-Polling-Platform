"use client";
import { useRouter } from "next/navigation";
import styles from "@/styles/PollCard.module.css";

const PollCard = ({ poll }) => {
  const router = useRouter();

  const getStatus = () => {
    if (!poll.is_active) return "Closed";
    const createdDate = new Date(poll.created_at);
    const now = new Date();
    const diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 7) return "Expiring Soon";
    return "Active";
  };

  const getStatusColor = () => {
    const status = getStatus();
    if (status === "Active") return styles.active;
    if (status === "Expiring Soon") return styles.warning;
    return styles.closed;
  };

  return (
    <div className={styles.card} onClick={() => router.push(`/poll/${poll.id}`)}>
      <div className={styles.header}>
        <h3>{poll.title}</h3>
        <span className={`${styles.status} ${getStatusColor()}`}>
          {getStatus()}
        </span>
      </div>
      
      {poll.description && <p className={styles.description}>{poll.description}</p>}
      
      <div className={styles.options}>
        {poll.options.slice(0, 3).map((option, idx) => (
          <div key={idx} className={styles.optionPreview}>
            • {option}
          </div>
        ))}
        {poll.options.length > 3 && (
          <div className={styles.more}>+{poll.options.length - 3} more</div>
        )}
      </div>
      
      <div className={styles.footer}>
        <span>Created by {poll.creator?.name || "Unknown"}</span>
        <button className={styles.voteBtn}>Vote Now →</button>
      </div>
    </div>
  );
};

export default PollCard;