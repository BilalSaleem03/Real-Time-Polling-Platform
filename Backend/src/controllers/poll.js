const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { User } = require('../models/User');
const { sequelize } = require('../config/database');
const CacheService = require('../services/cacheService');
const { redis } = require('../config/redis');
// Helper function to get poll results
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
    
    console.log(`✅ New poll created: ${poll.id} - ${poll.title}`);
    
    // CRITICAL: Clear the cached polls for this tenant
    await CacheService.clearPollCache(poll.id);
    
    // Delete the cached polls list for this tenant
    const cacheKey = `tenant:${tenantId}:polls`;
    await redis.del(cacheKey);
    console.log(`🗑️ Cleared tenant poll cache for tenant ${tenantId}`);
    
    // Also clear any individual poll caches that might exist
    const keys = await redis.keys(`poll:*:data`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🗑️ Cleared ${keys.length} individual poll caches`);
    }
    
    // Update tenant stats
    await CacheService.updateTenantStats(tenantId, 'totalPolls', 1);
    
    // Get the complete poll with creator info for response
    const completePoll = await Poll.findOne({
      where: { id: poll.id },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['name']
      }]
    });
    
    res.status(201).json({
      success: true,
      poll: completePoll
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
};

module.exports.getPolls = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const forceRefresh = req.query.refresh === 'true'; // Allow force refresh
    
    let polls = null;
    
    // Only use cache if not forcing refresh
    if (!forceRefresh) {
      polls = await CacheService.getActivePolls(tenantId);
    }
    
    if (!polls) {
      console.log('Fetching polls from database for tenant:', tenantId);
      polls = await Poll.findAll({
        where: { tenant_id: tenantId },
        include: [{
          model: User,
          as: 'creator',
          attributes: ['name']
        }],
        order: [['created_at', 'DESC']]
      });
      
      console.log(`Found ${polls.length} polls in database`);
      
      // Cache the results
      await CacheService.setActivePolls(tenantId, polls, 300); // 5 minutes cache
    }
    
    res.json({ success: true, polls });
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Failed to get polls' });
  }
};
module.exports.getPoll = async (req, res) => {
  try {
    const pollId = parseInt(req.params.id);
    const tenantId = req.tenantId;
    
    // Try to get poll from cache
    let poll = await CacheService.getPoll(pollId);
    
    if (!poll) {
      console.log(`Fetching poll ${pollId} from database...`);
      poll = await Poll.findOne({
        where: { id: pollId, tenant_id: tenantId },
        include: [{
          model: User,
          as: 'creator',
          attributes: ['name']
        }]
      });
      
      if (poll) {
        await CacheService.setPoll(pollId, poll, 1800);
      }
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Try to get results from cache
    let results = await CacheService.getPollResults(pollId);
    
    if (!results) {
      console.log(`Fetching results for poll ${pollId} from database...`);
      results = await getPollResultsFromDB(pollId);
      await CacheService.setPollResults(pollId, results, 3600);
    }
    
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
    const tenantId = req.tenantId;
    
    const poll = await Poll.findOne({
      where: { id: pollId, tenant_id: tenantId }
    });
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Try to get from cache first
    let results = await CacheService.getPollResults(pollId);
    
    if (!results) {
      results = await getPollResultsFromDB(pollId);
      await CacheService.setPollResults(pollId, results, 3600);
    }
    
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