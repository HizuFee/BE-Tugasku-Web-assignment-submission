const jwt = require('jsonwebtoken');
const User = require('../models/User');


module.exports = async (req, res, next) => {
  console.log('Auth middleware triggered');

  // Get token from header or query parameter
  const token = req.header('x-auth-token') || req.query.token;
  console.log('Token received:', token ? 'Yes' : 'No');
  
  // Check if no token
  if (!token) {
    console.log('Authorization denied - No token provided');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token successfully verified:', decoded);
    
    // Get user information including role
    console.log('Finding user with decoded userId:', decoded.userId);
    const user = await User.findById(decoded.userId);
    console.log('Found user in auth middleware:', user);
    
    if (!user) {
      console.log('User not found for ID:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = {
      userId: decoded.userId,
      role: user.role
    };
    console.log('Set req.user to:', req.user);
    
    next();
  } catch (err) {
    console.log('Invalid token:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};