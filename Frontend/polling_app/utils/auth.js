// src/utils/auth.js
import api from './api';

// Store authentication data
export const setAuthData = (token, user) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
};

// Clear authentication data (logout)
export const clearAuthData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Get stored token
export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Get stored user
export const getUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    }
  }
  return null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }
  return false;
};

// Check if user is admin
export const isAdmin = () => {
  const user = getUser();
  return user?.role === 'admin';
};

// Get user's tenant ID
export const getTenantId = () => {
  const user = getUser();
  return user?.tenantId;
};

// Get user's tenant name
export const getTenantName = () => {
  const user = getUser();
  return user?.tenantName;
};

// Register new user
export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    const { token, user } = response.data;
    setAuthData(token, user);
    return { success: true, user };
  } catch (error) {
    console.error('Registration error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Registration failed' 
    };
  }
};

// Login user
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    setAuthData(token, user);
    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Login failed' 
    };
  }
};

// Logout user
export const logout = () => {
  clearAuthData();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// Get current user info from API
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return { success: true, user: response.data };
  } catch (error) {
    console.error('Get current user error:', error);
    if (error.response?.status === 401) {
      clearAuthData();
    }
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to get user info' 
    };
  }
};

// Get all users in tenant (admin only)
export const getTenantUsers = async () => {
  try {
    const response = await api.get('/auth/tenant-users');
    return { success: true, users: response.data.users };
  } catch (error) {
    console.error('Get tenant users error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to get users' 
    };
  }
};

// Update user profile
export const updateProfile = async (userData) => {
  try {
    const response = await api.put('/auth/update-profile', userData);
    const { user } = response.data;
    // Update stored user data
    if (typeof window !== 'undefined') {
      const currentUser = getUser();
      if (currentUser) {
        setAuthData(getToken(), { ...currentUser, ...user });
      }
    }
    return { success: true, user };
  } catch (error) {
    console.error('Update profile error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to update profile' 
    };
  }
};

// Change password
export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await api.post('/auth/change-password', { 
      oldPassword, 
      newPassword 
    });
    return { success: true, message: response.data.message };
  } catch (error) {
    console.error('Change password error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to change password' 
    };
  }
};