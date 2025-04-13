// src/routes/assignment.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Function to sanitize filename
function sanitizeFilename(filename) {
    // Get the file extension
    const ext = path.extname(filename);
    // Get the filename without extension
    const name = path.basename(filename, ext);
    
    // Replace spaces and special characters
    const sanitizedName = name
        .toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '')     // Remove special characters
        .replace(/-+/g, '-')            // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '');       // Remove hyphens from start and end
    
    return `${sanitizedName}${ext}`;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads/assignments');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedFilename = sanitizeFilename(file.originalname);
        cb(null, `${uniqueSuffix}-${sanitizedFilename}`);
    }
});

const fileFilter = (req, file, cb) => {
    // Define allowed file types
    const allowedFileTypes = [
        // Documents
        '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt',
        // Images
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        // Archives
        '.zip', '.rar', '.tar', '.7z',
        // Other
        '.csv'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Tipe file tidak didukung'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Create assignment with file upload
router.post(
    '/create',
    [
        auth,
        upload.single('file'),
        check('class_id', 'Class ID is required').notEmpty(),
        check('title', 'Title is required').notEmpty(),
        check('description', 'Description is required').notEmpty(),
        check('deadline', 'Valid deadline is required').isISO8601()
    ],
    assignmentController.createAssignment
);

// Update assignment with file upload
router.put(
    '/:id',
    [
        auth,
        upload.single('file'),
        check('title', 'Title is required').notEmpty(),
        check('description', 'Description is required').notEmpty(),
        check('deadline', 'Valid deadline is required').isISO8601()
    ],
    assignmentController.updateAssignment
);

// Download assignment file
router.get(
  '/:id/download',
  auth, // Modified auth middleware that checks query params too
  assignmentController.downloadAssignmentFile
);

// Download submission file
router.get(
  '/:id/submissions/:submissionId/download',
  auth,
  assignmentController.downloadSubmissionFile
);

// Preview submission file
router.get(
  '/:id/submissions/:submissionId/preview',
  auth,
  assignmentController.previewSubmissionFile
);

// Other routes remain unchanged
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