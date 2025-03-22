const jwt = require('jsonwebtoken');
const User = require('../models/User');


module.exports = async (req, res, next) => {
  console.log('Auth middleware triggered');

  // Get token from header
  const token = req.header('x-auth-token');
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
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = {
      userId: decoded.userId,
      role: user.role
    };
    
    next();
  } catch (err) {
    console.log('Invalid token:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};