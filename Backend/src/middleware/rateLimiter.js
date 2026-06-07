const CacheService = require('../services/cacheService');

// Rate limiter for vote submission
const voteRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const key = `rate:vote:${userId}`;
    
    // Allow max 3 votes per minute
    const isAllowed = await CacheService.checkRateLimit(key, 3, 60);
    
    if (!isAllowed) {
      return res.status(429).json({ 
        error: 'Too many votes. Please wait before voting again.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // Allow on error
  }
};

// Rate limiter for poll creation
const pollCreationRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const key = `rate:create-poll:${userId}`;
    
    // Allow max 5 polls per hour
    const isAllowed = await CacheService.checkRateLimit(key, 5, 3600);
    
    if (!isAllowed) {
      return res.status(429).json({ 
        error: 'Too many polls created. Please wait before creating more.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
};

// Global API rate limiter
const globalRateLimiter = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate:global:${ip}`;
    
    // Allow max 100 requests per minute per IP
    const isAllowed = await CacheService.checkRateLimit(key, 100, 60);
    
    if (!isAllowed) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Global rate limiter error:', error);
    next();
  }
};

module.exports = {
  voteRateLimiter,
  pollCreationRateLimiter,
  globalRateLimiter
};