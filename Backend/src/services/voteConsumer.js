const { consumer, connectConsumer } = require('../config/kafka');
const { redis } = require('../config/redis');

let isRunning = false;

// Process vote events (runs in background)
const startVoteConsumer = async () => {
  try {
    if (isRunning) {
      console.log('⚠️ Kafka consumer already running');
      return;
    }
    
    const connected = await connectConsumer();
    if (!connected) {
      console.log('⚠️ Cannot start Kafka consumer - connection failed');
      return;
    }
    
    // Subscribe to topic
    await consumer.subscribe({ 
      topic: 'vote-events', 
      fromBeginning: false // Only new messages
    });
    
    // Start processing
    await consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
        try {
          const voteData = JSON.parse(message.value.toString());
          console.log(`📥 Processing vote event: Poll ${voteData.pollId}, Option ${voteData.optionIndex}`);
          
          // Process all analytics in background
          await Promise.all([
            updateRealTimeAnalytics(voteData),
            updateLeaderboard(voteData),
            checkMilestones(voteData),
            logAuditTrail(voteData),
            updateUserActivity(voteData),
            updateTenantStats(voteData)
          ]);
          
          console.log(`✅ Processed vote event for poll ${voteData.pollId}`);
        } catch (error) {
          console.error('Error processing vote message:', error);
          // Don't pause the consumer for individual message errors
        }
      },
      // Handle consumer errors
      autoCommit: true,
      autoCommitInterval: 5000,
    });
    
    isRunning = true;
    console.log('✅ Kafka consumer started and listening for vote events');
    
    // Handle consumer errors
    consumer.on('consumer.crash', (error) => {
      console.error('Kafka consumer crashed:', error);
      isRunning = false;
      // Attempt to restart after 5 seconds
      setTimeout(() => {
        if (!isRunning) {
          startVoteConsumer().catch(console.error);
        }
      }, 5000);
    });
    
  } catch (error) {
    console.error('Failed to start Kafka consumer:', error.message);
    isRunning = false;
  }
};

// Stop consumer
const stopVoteConsumer = async () => {
  try {
    if (isRunning) {
      await consumer.stop();
      isRunning = false;
      console.log('✅ Kafka consumer stopped');
    }
  } catch (error) {
    console.error('Error stopping consumer:', error);
  }
};

// Update real-time analytics in Redis
const updateRealTimeAnalytics = async (voteData) => {
  const { pollId, optionIndex, tenantId } = voteData;
  const now = new Date();
  const hour = now.getHours();
  const date = now.toISOString().split('T')[0];
  const minute = now.getMinutes();
  
  try {
    // Total votes per poll
    await redis.hincrby(`analytics:poll:${pollId}`, 'totalVotes', 1);
    
    // Votes per option
    await redis.hincrby(`analytics:poll:${pollId}:options`, `option_${optionIndex}`, 1);
    
    // Hourly voting stats
    const hourKey = `analytics:hourly:${date}:${hour}`;
    await redis.hincrby(hourKey, `poll_${pollId}`, 1);
    await redis.expire(hourKey, 86400); // Expire after 24 hours
    
    // Minute-by-minute for real-time chart (last 60 minutes)
    const minuteKey = `analytics:minute:${date}:${hour}:${minute}`;
    await redis.hincrby(minuteKey, `poll_${pollId}`, 1);
    await redis.expire(minuteKey, 3600); // Expire after 1 hour
    
    // Tenant-wide analytics
    await redis.hincrby(`analytics:tenant:${tenantId}`, 'totalVotes', 1);
    await redis.hincrby(`analytics:tenant:${tenantId}`, `poll_${pollId}_votes`, 1);
    
    
    console.log(`📊 Analytics updated for poll ${pollId}`);
  } catch (error) {
    console.error('Error updating analytics:', error);
  }
};

// Update leaderboard
const updateLeaderboard = async (voteData) => {
  const { pollId, optionIndex, tenantId } = voteData;
  
  try {
    // Top polls leaderboard (global)
    await redis.zincrby('leaderboard:top-polls', 1, `poll:${pollId}`);
    
    // Top polls by tenant
    await redis.zincrby(`leaderboard:tenant:${tenantId}:polls`, 1, `poll:${pollId}`);
    
    // Top options for this poll
    await redis.zincrby(`leaderboard:poll:${pollId}:options`, 1, `option:${optionIndex}`);
    
    // Get current rank (for logging)
    const rank = await redis.zrevrank('leaderboard:top-polls', `poll:${pollId}`);
    if (rank === 0) {
      console.log(`🏆 Poll ${pollId} is now #1 on leaderboard!`);
    }
    
    // Maintain leaderboard size (keep top 100)
    await redis.zremrangebyrank('leaderboard:top-polls', 100, -1);
    
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
};

// Check for vote milestones
const checkMilestones = async (voteData) => {
  const { pollId, optionIndex } = voteData;
  
  try {
    // Get current vote count
    const voteCount = await redis.hincrby(`milestones:poll:${pollId}`, 'total', 1);
    
    // Define milestones
    const milestones = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
    
    if (milestones.includes(voteCount)) {
      console.log(`🎉 MILESTONE: Poll ${pollId} reached ${voteCount} votes!`);
      
      // Store milestone event
      await redis.lpush(`milestones:events`, JSON.stringify({
        pollId,
        voteCount,
        optionIndex,
        timestamp: new Date().toISOString()
      }));
      
      // Could trigger webhook or notification here
      // await triggerMilestoneWebhook(pollId, voteCount);
    }
    
    // Option-specific milestones
    const optionVotes = await redis.hincrby(`milestones:poll:${pollId}:options`, `option_${optionIndex}`, 1);
    const optionMilestones = [5, 10, 25, 50, 100, 200, 500];
    
    if (optionMilestones.includes(optionVotes)) {
      console.log(`🎯 Option ${optionIndex} in poll ${pollId} reached ${optionVotes} votes!`);
    }
    
  } catch (error) {
    console.error('Error checking milestones:', error);
  }
};

// Log audit trail
const logAuditTrail = async (voteData) => {
  const { pollId, userId, optionIndex, timestamp, ip, userAgent } = voteData;
  
  try {
    // Create audit log entry
    const auditEntry = {
      id: `${Date.now()}-${userId}-${pollId}`,
      pollId,
      userId,
      optionIndex,
      timestamp,
      ip: ip || 'unknown',
      userAgent: userAgent || 'unknown',
      eventType: 'VOTE_CAST'
    };
    
    // Store in Redis list (keep last 10,000)
    await redis.lpush(`audit:poll:${pollId}`, JSON.stringify(auditEntry));
    await redis.ltrim(`audit:poll:${pollId}`, 0, 9999);
    
    // Store in global audit log
    await redis.lpush('audit:global', JSON.stringify(auditEntry));
    await redis.ltrim('audit:global', 0, 99999);
    
    // Store user activity
    await redis.lpush(`audit:user:${userId}`, JSON.stringify(auditEntry));
    await redis.ltrim(`audit:user:${userId}`, 0, 999);
    
  } catch (error) {
    console.error('Error logging audit trail:', error);
  }
};

// Update user activity tracking
const updateUserActivity = async (voteData) => {
  const { userId, pollId, tenantId } = voteData;
  
  try {
    // Update last active timestamp
    await redis.setex(`user:${userId}:lastActive`, 3600, Date.now().toString());
    
    // Track user vote count
    await redis.hincrby(`user:${userId}:stats`, 'totalVotes', 1);
    await redis.hincrby(`user:${userId}:stats`, `poll_${pollId}_voted`, 1);
    
    // Track active users for tenant
    await redis.sadd(`tenant:${tenantId}:activeUsers`, userId.toString());
    await redis.expire(`tenant:${tenantId}:activeUsers`, 3600);
    
    // Get user's vote streak
    const today = new Date().toISOString().split('T')[0];
    const lastVoteDay = await redis.get(`user:${userId}:lastVoteDay`);
    
    if (lastVoteDay === today) {
      // Already voted today
      const streak = await redis.hincrby(`user:${userId}:stats`, 'currentStreak', 0);
    } else if (lastVoteDay === getYesterday()) {
      // Consecutive day
      const streak = await redis.hincrby(`user:${userId}:stats`, 'currentStreak', 1);
      await redis.hincrby(`user:${userId}:stats`, 'longestStreak', 0);
      
      // Update longest streak if needed
      const currentStreak = parseInt(await redis.hget(`user:${userId}:stats`, 'currentStreak') || '0');
      const longestStreak = parseInt(await redis.hget(`user:${userId}:stats`, 'longestStreak') || '0');
      if (currentStreak > longestStreak) {
        await redis.hset(`user:${userId}:stats`, 'longestStreak', currentStreak);
      }
    } else {
      // Streak broken
      await redis.hset(`user:${userId}:stats`, 'currentStreak', 1);
    }
    
    await redis.setex(`user:${userId}:lastVoteDay`, 86400, today);
    
  } catch (error) {
    console.error('Error updating user activity:', error);
  }
};

// Update tenant statistics
const updateTenantStats = async (voteData) => {
  const { tenantId, pollId } = voteData;
  
  try {
    // Overall tenant stats
    await redis.hincrby(`tenant:${tenantId}:total`, 'votes', 1);
    await redis.hincrby(`tenant:${tenantId}:total`, `poll_${pollId}_votes`, 1);
    
    // Daily stats
    const today = new Date().toISOString().split('T')[0];
    await redis.hincrby(`tenant:${tenantId}:daily:${today}`, 'votes', 1);
    await redis.expire(`tenant:${tenantId}:daily:${today}`, 86400 * 7); // Keep 7 days
    
    // Active polls count
    const activePolls = await redis.sadd(`tenant:${tenantId}:activePolls`, pollId.toString());
    
    // Update vote velocity (votes per minute)
    const currentMinute = Math.floor(Date.now() / 60000);
    await redis.hincrby(`tenant:${tenantId}:velocity:${currentMinute}`, 'votes', 1);
    await redis.expire(`tenant:${tenantId}:velocity:${currentMinute}`, 3600);
    
  } catch (error) {
    console.error('Error updating tenant stats:', error);
  }
};

// Helper function to get yesterday's date
const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

module.exports = { startVoteConsumer, stopVoteConsumer };