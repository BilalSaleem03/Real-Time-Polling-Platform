const express = require("express");
const route = express.Router();
const isLoggedIn = require("../middleware/auth");
const { redis } = require("../config/redis");

// Get poll analytics - make sure this endpoint exists
route.get("/poll/:pollId", isLoggedIn, async (req, res) => {
  try {
    const { pollId } = req.params;
    const tenantId = req.tenantId;
    
    // Get analytics from Redis
    const pollStats = await redis.hgetall(`analytics:poll:${pollId}`);
    const leaderboardPosition = await redis.zrevrank('leaderboard:top-polls', `poll:${pollId}`);
    const voteVelocity = await redis.hgetall(`tenant:${tenantId}:velocity:${Math.floor(Date.now() / 60000)}`);
    
    const totalVotes = parseInt(pollStats?.totalVotes || 0);
    
    res.json({
      success: true,
      analytics: {
        totalVotes: totalVotes,
        optionBreakdown: await redis.hgetall(`analytics:poll:${pollId}:options`) || {},
        leaderboardRank: leaderboardPosition !== null ? leaderboardPosition + 1 : null,
        recentVelocity: parseInt(voteVelocity?.votes || 0),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({
      success: true,
      analytics: {
        totalVotes: 0,
        leaderboardRank: null,
        recentVelocity: 0,
        lastUpdated: new Date().toISOString()
      }
    });
  }
});

// Get global leaderboard
route.get("/leaderboard", isLoggedIn, async (req, res) => {
  try {
    const topPolls = await redis.zrevrange('leaderboard:top-polls', 0, 9, 'WITHSCORES');
    
    const leaderboard = [];
    for (let i = 0; i < topPolls.length; i += 2) {
      leaderboard.push({
        pollId: parseInt(topPolls[i].replace('poll:', '')),
        votes: parseInt(topPolls[i + 1])
      });
    }
    
    // Get tenant-specific leaderboard
    const tenantTopPolls = await redis.zrevrange(`leaderboard:tenant:${req.tenantId}:polls`, 0, 4, 'WITHSCORES');
    const tenantLeaderboard = [];
    for (let i = 0; i < tenantTopPolls.length; i += 2) {
      tenantLeaderboard.push({
        pollId: parseInt(tenantTopPolls[i].replace('poll:', '')),
        votes: parseInt(tenantTopPolls[i + 1])
      });
    }
    
    res.json({ 
      success: true, 
      global: leaderboard,
      tenant: tenantLeaderboard
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get user statistics
route.get("/user/stats", isLoggedIn, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userStats = await redis.hgetall(`user:${userId}:stats`);
    const lastActive = await redis.get(`user:${userId}:lastActive`);
    const recentVotes = await redis.lrange(`audit:user:${userId}`, 0, 9);
    
    res.json({
      success: true,
      stats: {
        totalVotes: parseInt(userStats?.totalVotes || 0),
        currentStreak: parseInt(userStats?.currentStreak || 0),
        longestStreak: parseInt(userStats?.longestStreak || 0),
        lastActive: lastActive ? new Date(parseInt(lastActive)).toISOString() : null,
        recentVotes: recentVotes.map(v => JSON.parse(v))
      }
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Get tenant analytics
route.get("/tenant", isLoggedIn, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const totalStats = await redis.hgetall(`tenant:${tenantId}:total`);
    const activeUsers = await redis.scard(`tenant:${tenantId}:activeUsers`);
    const activePolls = await redis.smembers(`tenant:${tenantId}:activePolls`);
    
    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await redis.hgetall(`tenant:${tenantId}:daily:${today}`);
    
    res.json({
      success: true,
      analytics: {
        totalVotes: parseInt(totalStats?.votes || 0),
        activeUsers,
        activePolls: activePolls.length,
        todayVotes: parseInt(todayStats?.votes || 0),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Tenant analytics error:', error);
    res.status(500).json({ error: 'Failed to get tenant analytics' });
  }
});

// Get vote milestones
route.get("/milestones/:pollId", isLoggedIn, async (req, res) => {
  try {
    const { pollId } = req.params;
    
    const currentVotes = await redis.hget(`milestones:poll:${pollId}`, 'total');
    const milestones = await redis.lrange('milestones:events', 0, 19);
    
    const pollMilestones = milestones
      .map(m => JSON.parse(m))
      .filter(m => m.pollId === parseInt(pollId));
    
    res.json({
      success: true,
      milestones: {
        currentVotes: parseInt(currentVotes || 0),
        achievedMilestones: pollMilestones,
        nextMilestone: getNextMilestone(parseInt(currentVotes || 0))
      }
    });
  } catch (error) {
    console.error('Milestones error:', error);
    res.status(500).json({ error: 'Failed to get milestones' });
  }
});

// Helper to find next milestone
const getNextMilestone = (currentVotes) => {
  const milestones = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
  const next = milestones.find(m => m > currentVotes);
  return next || null;
};

module.exports = route;