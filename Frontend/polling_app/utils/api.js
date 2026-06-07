import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false, // Don't send credentials
});

// Add token to every request
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("token");
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("✅ Token added to request:", config.url); // Debug log
    } else {
      console.log("⚠️ No token found for request:", config.url);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      console.log("🔐 Unauthorized - Clearing token and redirecting to login");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes("/login") && 
          !window.location.pathname.includes("/register")) {
        window.location.href = "/login";
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;