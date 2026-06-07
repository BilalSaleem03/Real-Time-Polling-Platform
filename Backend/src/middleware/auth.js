const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

const isLoggedIn = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Make sure to select the role field
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'name', 'tenant_id', 'role']
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = user;
    req.tenantId = user.tenant_id;
    
    console.log(`🔐 Auth middleware: User ${user.email} (${user.role}) authenticated`);
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = isLoggedIn;