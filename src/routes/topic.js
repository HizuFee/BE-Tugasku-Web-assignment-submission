const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const topicController = require('../controllers/topicController');
const auth = require('../middlewares/auth');

// Create topic
router.post(
  '/create',
  [
    auth,
    check('name', 'Nama topik harus diisi').notEmpty(),
    check('class_id', 'ID kelas harus diisi').notEmpty()
  ],
  topicController.createTopic
);

// Get topics for a class
router.get(
  '/class/:classId',
  auth,
  topicController.getClassTopics
);

// Update topic
router.put(
  '/:id',
  [
    auth,
    check('name', 'Nama topik harus diisi').notEmpty()
  ],
  topicController.updateTopic
);

// Delete topic
router.delete(
  '/:id',
  auth,
  topicController.deleteTopic
);

// Assign topics to assignment
router.post(
  '/assignment/:assignmentId',
  [
    auth,
    check('topic_ids', 'ID topik harus diisi').isArray()
  ],
  topicController.assignTopicsToAssignment
);

// Get topics for an assignment
router.get(
  '/assignment/:assignmentId',
  auth,
  topicController.getAssignmentTopics
);

module.exports = router; 