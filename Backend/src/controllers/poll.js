const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { User } = require('../models/User');
const { sequelize } = require('../config/database');

module.exports.createPoll = async (req, res) => {
  try {
    const { title, description, options } = req.body;
    const tenantId = req.tenantId;
    const userId = req.user.id;

    if (!title || !options || options.length < 2) {
      return res.status(400).json({ error: 'Title and at least 2 options required' });
    }

    const poll = await Poll.create({
      tenant_id: tenantId,
      title,
      description,
      options,
      created_by: userId
    });
    
    res.status(201).json({
      success: true,
      poll
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
};

module.exports.getPolls = async (req, res) => {
  try {
    const polls = await Poll.findAll({
      where: { tenant_id: req.tenantId },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['name']
      }],
      order: [['created_at', 'DESC']]
    });
    
    res.json({ success: true, polls });
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Failed to get polls' });
  }
};

module.exports.getPoll = async (req, res) => {
  try {
    const pollId = parseInt(req.params.id);
    
    const poll = await Poll.findOne({
      where: { id: pollId, tenant_id: req.tenantId },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['name']
      }]
    });
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Get results
    const results = await getPollResults(pollId);
    
    res.json({
      success: true,
      poll,
      results
    });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Failed to get poll' });
  }
};

module.exports.getPollResults = async (req, res) => {
  try {
    const pollId = parseInt(req.params.id);
    
    const poll = await Poll.findOne({
      where: { id: pollId, tenant_id: req.tenantId }
    });
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    const results = await getPollResults(pollId);
    
    res.json({
      success: true,
      results,
      options: poll.options
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
};

// Helper function to get poll results
const getPollResults = async (pollId) => {
  const votes = await Vote.findAll({
    where: { poll_id: pollId },
    attributes: ['option_index', [sequelize.fn('COUNT', sequelize.col('option_index')), 'count']],
    group: ['option_index']
  });
  
  // Get poll options
  const poll = await Poll.findByPk(pollId);
  if (!poll) return [];
  
  const results = new Array(poll.options.length).fill(0);
  votes.forEach(vote => {
    results[vote.option_index] = parseInt(vote.dataValues.count);
  });
  
  return results;
};