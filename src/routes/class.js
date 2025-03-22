// src/routes/class.js
const express = require('express');
const { check } = require('express-validator');
const classController = require('../controllers/classController');
const auth = require('../middlewares/auth');
const router = express.Router();

// Create a class (teachers only)
router.post(
  '/create',
  [
    auth,
    check('name', 'Class name is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty()
  ],
  classController.createClass
);

// Get my classes
router.get('/my-classes', auth, classController.getMyClasses);

// Join a class (both students and teachers)
router.post(
  '/join',
  [
    auth,
    check('code', 'Class code is required').not().isEmpty()
  ],
  classController.joinClass
);

// Get class details
router.get('/:id', auth, classController.getClassDetails);

module.exports = router;