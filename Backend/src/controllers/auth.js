const jwt = require('jsonwebtoken');
const { User, hashPassword, verifyPassword } = require('../models/User');
const Tenant = require('../models/Tenant');
const { sequelize } = require('../config/database');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// MAIN REGISTER FUNCTION - Handles both new and existing tenants
module.exports.register = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { tenantName, email, password, name } = req.body;

    // Validate required fields
    if (!tenantName || !email || !password) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Email already registered' });
    }

    // CHECK IF TENANT ALREADY EXISTS
    let tenant = await Tenant.findOne({ 
      where: { name: tenantName } 
    });

    let isNewTenant = false;
    let userRole = 'member';

    // If tenant doesn't exist, create new one
    if (!tenant) {
      tenant = await Tenant.create({
        name: tenantName
      }, { transaction });
      isNewTenant = true;
      userRole = 'admin'; // First user becomes admin
      console.log(`✅ Created new tenant: ${tenantName} with admin user`);
    } else {
      console.log(`📌 Using existing tenant: ${tenantName} (ID: ${tenant.id})`);
      // Check if this is the first user of the tenant (should be admin)
      const userCount = await User.count({ where: { tenant_id: tenant.id } });
      if (userCount === 0) {
        userRole = 'admin'; // First user in existing tenant becomes admin
        console.log(`👑 First user in ${tenantName} becomes admin`);
      } else {
        userRole = 'member'; // Additional users become members
        console.log(`👤 New member joining ${tenantName}`);
      }
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      tenant_id: tenant.id,
      email,
      password_hash: hashedPassword,
      name: name || email.split('@')[0],
      role: userRole
    }, { transaction });

    await transaction.commit();

    // Generate token
    const token = generateToken(user.id);

    console.log(`✅ User created: ${email}, Role: ${userRole}, Tenant: ${tenantName}`);

    res.status(201).json({
      success: true,
      message: isNewTenant ? 'Company created successfully' : 'Joined existing company successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id,
        tenantName: tenant.name,
        role: user.role,
        isNewTenant: isNewTenant
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Register error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Tenant name or email already exists' });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// LOGIN FUNCTION
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user with role included
    const user = await User.findOne({ 
      where: { email },
      attributes: ['id', 'email', 'name', 'tenant_id', 'role', 'password_hash']
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get tenant
    const tenant = await Tenant.findByPk(user.tenant_id);

    // Generate token
    const token = generateToken(user.id);

    console.log(`✅ User logged in: ${email}, Role: ${user.role}, Tenant: ${tenant.name}`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id,
        tenantName: tenant.name,
        role: user.role // Make sure role is included
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// GET CURRENT USER
module.exports.getMe = async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.user.tenant_id);
    
    console.log(`📋 Getting user info: ${req.user.email}, Role: ${req.user.role}`);
    
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      tenantId: req.user.tenant_id,
      tenantName: tenant.name,
      role: req.user.role
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

// GET ALL USERS IN MY TENANT (for admin dashboard)
module.exports.getTenantUsers = async (req, res) => {
  try {
    console.log(`🔍 Checking admin access for user: ${req.user.email}, Role: ${req.user.role}`);
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log(`❌ Access denied: User ${req.user.email} is not admin (role: ${req.user.role})`);
      return res.status(403).json({ error: 'Only admins can view all users' });
    }

    const users = await User.findAll({
      where: { tenant_id: req.tenantId },
      attributes: ['id', 'email', 'name', 'role', 'created_at']
    });

    console.log(`✅ Found ${users.length} users in tenant ${req.tenantId}`);
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};
