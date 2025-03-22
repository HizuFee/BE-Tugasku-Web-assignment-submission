// src/routes/auth.js
const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
  check('role', 'Role harus teacher atau student').not().isEmpty().isIn(['teacher', 'student']),
], authController.register);

router.post('/login', [ 
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], authController.login);

module.exports = router;