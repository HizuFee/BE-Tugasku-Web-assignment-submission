// src/routes/assignment.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  }
});

// Create assignment
router.post(
  '/create',
  [
    auth,
    check('class_id', 'Class ID is required').notEmpty(),
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('deadline', 'Valid deadline is required').isISO8601()
  ],
  assignmentController.createAssignment
);

// Get all assignments for a class
router.get(
  '/class/:classId',
  auth,
  assignmentController.getClassAssignments
);

// Get assignment details
router.get(
  '/:id',
  auth,
  assignmentController.getAssignmentDetails
);

// Update assignment
router.put(
  '/:id',
  [
    auth,
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('deadline', 'Valid deadline is required').isISO8601()
  ],
  assignmentController.updateAssignment
);

// Delete assignment
router.delete(
  '/:id',
  auth,
  assignmentController.deleteAssignment
);

// Submit assignment (for students)
router.post(
  '/:id/submit',
  [
    auth,
    upload.single('file')
  ],
  assignmentController.submitAssignment
);

// Grade submission (for teachers)
router.put(
  '/submission/:id/grade',
  [
    auth,
    check('grade', 'Grade is required').isNumeric(),
    check('feedback', 'Feedback is required').notEmpty()
  ],
  assignmentController.gradeSubmission
);

module.exports = router;