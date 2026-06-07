"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import styles from "@/styles/CreatePoll.module.css";

export default function CreatePoll() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
        alert("Please enter a poll title");
        return;
    }
    
    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
        alert("Please add at least 2 options");
        return;
    }

    setLoading(true);
    
    try {
        const response = await api.post("/polls", {
        title,
        description,
        options: validOptions,
        });
        
        console.log("Poll created successfully:", response.data.poll);
        
        // Force clear the dashboard cache by making a refresh request
        await api.get("/polls?refresh=true");
        
        // Redirect to the new poll
        router.push(`/poll/${response.data.poll.id}`);
    } catch (error) {
        console.error("Error creating poll:", error);
        alert("Failed to create poll");
    } finally {
        setLoading(false);
    }
    };

  return (
    <div className={styles.container}>
      <h1>Create New Poll</h1>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Poll Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter your poll question"
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more context to your poll"
            rows="3"
          />
        </div>

        <div className={styles.optionsSection}>
          <label>Poll Options * (Minimum 2)</label>
          {options.map((option, index) => (
            <div key={index} className={styles.optionInput}>
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className={styles.removeBtn}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          
          {options.length < 10 && (
            <button type="button" onClick={addOption} className={styles.addBtn}>
              + Add Option
            </button>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => router.back()} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Creating..." : "Create Poll"}
          </button>
        </div>
      </form>
    </div>
  );
}