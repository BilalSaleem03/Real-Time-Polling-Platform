const Vote = require('../models/Vote');
const Poll = require('../models/Poll');
const { sequelize } = require('../config/database');

module.exports.submitVote = async (req, res) => {
  try {
    const { pollId, optionIndex } = req.body;
    const userId = req.user.id;
    const tenantId = req.tenantId;

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

    // Check if already voted
    const existingVote = await Vote.findOne({
      where: { poll_id: pollId, user_id: userId }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Submit vote
    await Vote.create({
      poll_id: pollId,
      user_id: userId,
      option_index: optionIndex
    });

    // Get updated results
    const updatedResults = await getPollResults(pollId);

    // Emit real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`poll-${pollId}`).emit('vote-update', {
      pollId,
      results: updatedResults,
      options: poll.options
    });

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

    const vote = await Vote.findOne({
      where: { poll_id: pollId, user_id: userId }
    });
    
    res.json({
      hasVoted: !!vote,
      voteOption: vote?.option_index || null
    });
  } catch (error) {
    console.error('Check vote error:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
};

// Helper function
const getPollResults = async (pollId) => {
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