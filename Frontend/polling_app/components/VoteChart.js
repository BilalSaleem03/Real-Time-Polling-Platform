"use client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import styles from "@/styles/VoteChart.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const VoteChart = ({ options, results }) => {
  const totalVotes = results.reduce((sum, count) => sum + count, 0);

  const chartData = {
    labels: options,
    datasets: [
      {
        label: "Votes",
        data: results,
        backgroundColor: [
          "#6366f1",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#8b5cf6",
          "#ec4899",
          "#06b6d4",
          "#84cc16",
        ],
        borderColor: "#fff",
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: `Total Votes: ${totalVotes}`,
      },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.barChart}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      <div className={styles.pieChart}>
        <Pie data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default VoteChart;