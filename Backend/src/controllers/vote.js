const Vote = require('../models/Vote');
const Poll = require('../models/Poll');
const { sequelize } = require('../config/database');
const CacheService = require('../services/cacheService');
const { sendVoteEvent } = require('../services/voteProducer');

// Helper function to get poll results from database
const getPollResultsFromDB = async (pollId) => {
  const votes = await Vote.findAll({
    where: { poll_id: pollId },
    attributes: ['option_index', [sequelize.fn('COUNT', sequelize.col('option_index')), 'count']],
    group: ['option_index']
  });
  
  const poll = await Poll.findByPk(pollId);
  if (!poll) return [];
  
  const results = new Array(poll.options.length).fill(0);
  votes.forEach(vote => {
    results[vote.option_index] = parseInt(vote.dataValues.count);
  });
  
  return results;
};

module.exports.submitVote = async (req, res) => {
  try {
    const { pollId, optionIndex } = req.body;
    const userId = req.user.id;
    const tenantId = req.tenantId;

    console.log(`🗳️ Vote received - Poll: ${pollId}, User: ${userId}, Option: ${optionIndex}`);

    // Check if poll exists and belongs to tenant
    const poll = await Poll.findOne({
      where: { id: pollId, tenant_id: tenantId }
    });
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.is_active) {
      return res.status(400).json({ error: 'Poll is closed' });
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ error: 'Invalid option' });
    }

    // Check Redis cache for duplicate vote (FAST)
    const hasVoted = await CacheService.hasUserVoted(pollId, userId);
    if (hasVoted) {
      console.log(`⚠️ User ${userId} already voted in poll ${pollId} (checked via Redis)`);
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Double-check database for duplicate (SAFETY)
    const existingVote = await Vote.findOne({
      where: { poll_id: pollId, user_id: userId }
    });

    if (existingVote) {
      await CacheService.markUserVoted(pollId, userId, optionIndex);
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Submit vote to database
    await Vote.create({
      poll_id: pollId,
      user_id: userId,
      option_index: optionIndex
    });

    console.log(`✅ Vote saved to database for poll ${pollId}`);

    // Mark user as voted in Redis (24 hours TTL)
    await CacheService.markUserVoted(pollId, userId, optionIndex, 86400);
    
    // Update vote count in Redis
    await CacheService.updateVoteCount(pollId, optionIndex);
    
    // Update tenant stats
    await CacheService.updateTenantStats(tenantId, 'totalVotes', 1);

    // Send to Kafka for background processing (non-blocking)
    // This won't slow down the response
    sendVoteEvent({
      pollId,
      optionIndex,
      userId,
      tenantId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }).catch(err => console.error('Kafka send error:', err.message));

    // Get updated results (try Redis first)
    let updatedResults = await CacheService.getVoteCounts(pollId, poll.options.length);
    
    if (!updatedResults) {
      updatedResults = await getPollResultsFromDB(pollId);
      await CacheService.setPollResults(pollId, updatedResults, 3600);
    }
    
    console.log(`📊 Updated results: ${updatedResults}`);

    // Clear tenant polls cache
    await CacheService.setActivePolls(tenantId, null, 0);
    
    // Get Socket.IO instance and emit update
    const io = req.app.get('io');
    if (io) {
      const roomName = `poll-${pollId}`;
      console.log(`📡 Emitting vote-update to room: ${roomName}`);
      
      io.to(roomName).emit('vote-update', {
        pollId: parseInt(pollId),
        results: updatedResults,
        options: poll.options,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Vote-update emitted to room ${roomName}`);
    }

    res.json({
      success: true,
      message: 'Vote submitted successfully',
      results: updatedResults
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
};

module.exports.checkUserVote = async (req, res) => {
  try {
    const pollId = parseInt(req.params.pollId);
    const userId = req.user.id;
    const tenantId = req.tenantId;

    const poll = await Poll.findOne({
      where: { id: pollId, tenant_id: tenantId }
    });
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check Redis cache first (FAST)
    let hasVoted = await CacheService.hasUserVoted(pollId, userId);
    let voteOption = null;
    
    // If not in Redis, check database
    if (!hasVoted) {
      const vote = await Vote.findOne({
        where: { poll_id: pollId, user_id: userId }
      });
      
      hasVoted = !!vote;
      voteOption = vote?.option_index || null;
      
      if (hasVoted) {
        await CacheService.markUserVoted(pollId, userId, voteOption);
      }
    }
    
    res.json({
      hasVoted,
      voteOption
    });
  } catch (error) {
    console.error('Check vote error:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
};