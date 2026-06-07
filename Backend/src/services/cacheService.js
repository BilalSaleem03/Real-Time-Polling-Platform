const { redis } = require('../config/redis');


class CacheService {
  // Get poll results from cache
  static async getPollResults(pollId) {
    try {
      const cached = await redis.get(`poll:${pollId}:results`);
      if (cached) {
        console.log(`📦 Cache HIT for poll ${pollId}`);
        return JSON.parse(cached);
      }
      console.log(`📦 Cache MISS for poll ${pollId}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set poll results in cache
  static async setPollResults(pollId, results, ttl = 3600) {
    try {
      await redis.setex(`poll:${pollId}:results`, ttl, JSON.stringify(results));
      console.log(`💾 Cached results for poll ${pollId} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Get single poll from cache
  static async getPoll(pollId) {
    try {
      const cached = await redis.get(`poll:${pollId}:data`);
      if (cached) {
        console.log(`📦 Cache HIT for poll data ${pollId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Cache get poll error:', error);
      return null;
    }
  }

  // Set single poll in cache
  static async setPoll(pollId, pollData, ttl = 1800) {
    try {
      await redis.setex(`poll:${pollId}:data`, ttl, JSON.stringify(pollData));
      console.log(`💾 Cached poll data ${pollId} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Cache set poll error:', error);
      return false;
    }
  }

  // Clear cache for a poll
  static async clearPollCache(pollId) {
    try {
      await redis.del(`poll:${pollId}:results`);
      await redis.del(`poll:${pollId}:data`);
      await redis.del(`poll:${pollId}:votes`);
      console.log(`🗑️ Cleared cache for poll ${pollId}`);
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  // Get vote count for rate limiting
  static async checkRateLimit(key, limit, windowSeconds) {
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      return current <= limit;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true; // Allow on error
    }
  }

  // Get user's vote status
  static async hasUserVoted(pollId, userId) {
    try {
      const voted = await redis.get(`vote:${pollId}:${userId}`);
      return voted !== null;
    } catch (error) {
      console.error('Check user vote error:', error);
      return null;
    }
  }

  // Mark user as voted
  static async markUserVoted(pollId, userId, optionIndex, ttl = 86400) {
    try {
      await redis.setex(`vote:${pollId}:${userId}`, ttl, optionIndex.toString());
      console.log(`✅ Marked user ${userId} voted for poll ${pollId}`);
      return true;
    } catch (error) {
      console.error('Mark user vote error:', error);
      return false;
    }
  }

 
    // Update the getActivePolls method to handle empty results
    static async getActivePolls(tenantId) {
    try {
        const cached = await redis.get(`tenant:${tenantId}:polls`);
        if (cached) {
        console.log(`📦 Cache HIT for tenant ${tenantId} polls`);
        const polls = JSON.parse(cached);
        // Return null if cache is empty array (no polls)
        return polls.length === 0 ? null : polls;
        }
        console.log(`📦 Cache MISS for tenant ${tenantId} polls`);
        return null;
    } catch (error) {
        console.error('Get active polls error:', error);
        return null;
    }
    }

  static async setActivePolls(tenantId, polls, ttl = 300) {
    try {
        if (!polls || polls.length === 0) {
        // Cache empty result for shorter time (30 seconds)
        await redis.setex(`tenant:${tenantId}:polls`, 30, JSON.stringify([]));
        console.log(`💾 Cached empty polls for tenant ${tenantId} (TTL: 30s)`);
        } else {
        await redis.setex(`tenant:${tenantId}:polls`, ttl, JSON.stringify(polls));
        console.log(`💾 Cached ${polls.length} polls for tenant ${tenantId} (TTL: ${ttl}s)`);
        }
        return true;
    } catch (error) {
        console.error('Set active polls error:', error);
        return false;
    }
    }

  // Update vote count in real-time
  static async updateVoteCount(pollId, optionIndex) {
    try {
      const key = `poll:${pollId}:votes`;
      const count = await redis.hincrby(key, optionIndex, 1);
      await redis.expire(key, 3600);
      console.log(`📊 Updated vote count for poll ${pollId}, option ${optionIndex}: ${count}`);
      return count;
    } catch (error) {
      console.error('Update vote count error:', error);
      return null;
    }
  }
  static async clearTenantPollsCache(tenantId) {
    try {
        const key = `tenant:${tenantId}:polls`;
        await redis.del(key);
        console.log(`🗑️ Cleared tenant polls cache for tenant ${tenantId}`);
        return true;
    } catch (error) {
        console.error('Clear tenant polls cache error:', error);
        return false;
    }
    }

  // Get vote counts from Redis
  static async getVoteCounts(pollId, optionsLength) {
    try {
      const key = `poll:${pollId}:votes`;
      const counts = await redis.hgetall(key);
      
      if (Object.keys(counts).length === 0) {
        return null;
      }
      
      const results = new Array(optionsLength).fill(0);
      for (const [index, count] of Object.entries(counts)) {
        results[parseInt(index)] = parseInt(count);
      }
      
      return results;
    } catch (error) {
      console.error('Get vote counts error:', error);
      return null;
    }
  }

  // Get tenant stats (total votes, polls, etc.)
  static async getTenantStats(tenantId) {
    try {
      const stats = await redis.hgetall(`tenant:${tenantId}:stats`);
      if (Object.keys(stats).length === 0) {
        return null;
      }
      return {
        totalVotes: parseInt(stats.totalVotes) || 0,
        totalPolls: parseInt(stats.totalPolls) || 0,
        activeUsers: parseInt(stats.activeUsers) || 0
      };
    } catch (error) {
      console.error('Get tenant stats error:', error);
      return null;
    }
  }

  // Update tenant stats
  static async updateTenantStats(tenantId, field, increment = 1) {
    try {
      await redis.hincrby(`tenant:${tenantId}:stats`, field, increment);
      await redis.expire(`tenant:${tenantId}:stats`, 86400);
      return true;
    } catch (error) {
      console.error('Update tenant stats error:', error);
      return false;
    }
  }
}

module.exports = CacheService;