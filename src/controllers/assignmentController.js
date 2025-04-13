// src/controllers/assignmentController.js
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const ClassStudent = require('../models/ClassStudent');
const ClassContributor = require('../models/ClassContributor');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const User = require('../models/User');

exports.createAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { class_id, title, description, deadline } = req.body;
    
    // Check if user has permission (owner or contributor)
    const isOwner = await ClassContributor.isOwner(class_id, userId);
    const isContributor = await ClassContributor.isContributor(class_id, userId);
    
    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'You do not have permission to create assignments for this class' });
    }
    
    // Handle file upload
    let filePath = null;
    if (req.file) {
      filePath = req.file.path;
    }
    
    const assignment = await Assignment.create({
      class_id,
      title,
      description,
      deadline,
      created_by: userId,
      file_path: filePath
    });
    
    // Initialize pending submissions for all students in the class
    const students = await ClassStudent.getClassStudents(class_id);
    const studentIds = students.map(student => student.id);
    await Submission.initializeForAssignment(assignment.id, studentIds);
    
    res.status(201).json({
      message: 'Assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Error in createAssignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getClassAssignments = async (req, res) => {
  try {
    const classId = req.params.classId;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Verify user has access to this class
    let hasAccess = false;
    
    if (userRole === 'teacher') {
      const isOwner = await ClassContributor.isOwner(classId, userId);
      const isContributor = await ClassContributor.isContributor(classId, userId);
      hasAccess = isOwner || isContributor;
    } else if (userRole === 'student') {
      const studentClasses = await ClassStudent.getStudentClasses(userId);
      hasAccess = studentClasses.some(c => c.id === parseInt(classId));
    }
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this class' });
    }
    
    const assignments = await Assignment.findByClassId(classId);
    
    // If student, include submission status for each assignment
    if (userRole === 'student') {
      for (let i = 0; i < assignments.length; i++) {
        const submission = await Submission.findByAssignmentAndStudent(
          assignments[i].id, 
          userId
        );
        
        assignments[i].submission = submission || { status: 'pending' };
      }
    }
    
    res.json({ assignments });
  } catch (error) {
    console.error('Error in getClassAssignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAssignmentDetails = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Verify user has access to this assignment
    let hasAccess = false;
    let userClassRole = '';
    
    if (userRole === 'teacher') {
      const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
      const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
      
      hasAccess = isOwner || isContributor;
      userClassRole = isOwner ? 'owner' : 'contributor';
    } else if (userRole === 'student') {
      const studentClasses = await ClassStudent.getStudentClasses(userId);
      hasAccess = studentClasses.some(c => c.id === assignment.class_id);
      userClassRole = 'student';
    }
   
    if (assignment.file_path) {
      // Convert relative path to absolute URL
      assignment.file_url = `/uploads/${path.basename(assignment.file_path)}`;
    }
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this assignment' });
    }
    
    let submissions = [];
    let userSubmission = null;
    
    if (userRole === 'teacher') {
      // Get all submissions for this assignment
      submissions = await Submission.findByAssignmentId(assignmentId);
    } else if (userRole === 'student') {
      // Get only this student's submission
      userSubmission = await Submission.findByAssignmentAndStudent(assignmentId, userId);
    }
    
    res.json({
      assignment,
      userClassRole,
      submissions: userRole === 'teacher' ? submissions : [],
      userSubmission: userRole === 'student' ? userSubmission : null
    });
  } catch (error) {
    console.error('Error in getAssignmentDetails:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId;
    const { title, description, deadline } = req.body;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if user has permission (owner or contributor)
    const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
    const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
    
    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'You do not have permission to update this assignment' });
    }
    
    // Handle file update
    let filePath = undefined; // undefined means don't update the file path
    if (req.file) {
      filePath = req.file.path;
      
      // If there was an old file, remove it
      const oldFilePath = await Assignment.getFilePath(assignmentId);
      if (oldFilePath && fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    await Assignment.update(assignmentId, { 
      title, 
      description, 
      deadline,
      file_path: filePath
    });
    
    const updatedAssignment = await Assignment.findById(assignmentId);
    
    res.json({
      message: 'Assignment updated successfully',
      assignment: updatedAssignment
    });
  } catch (error) {
    console.error('Error in updateAssignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if user has permission (owner or contributor)
    const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
    const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
    
    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'You do not have permission to delete this assignment' });
    }

    // Delete associated file if it exists
    if (assignment.file_path && fs.existsSync(assignment.file_path)) {
      fs.unlinkSync(assignment.file_path);
    }
    
    await Assignment.delete(assignmentId);
    
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAssignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.downloadAssignmentFile = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    if (!assignment.file_path) {
      return res.status(404).json({ message: 'No file attached to this assignment' });
    }
    
    // Check if user has access to this assignment
    let hasAccess = false;
    
    if (req.user.role === 'teacher') {
      const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
      const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
      hasAccess = isOwner || isContributor;
    } else {
      const studentClasses = await ClassStudent.getStudentClasses(userId);
      hasAccess = studentClasses.some(c => c.id === assignment.class_id);
    }
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this file' });
    }
    
    // Get file type
    const fileType = path.extname(assignment.file_path).toLowerCase();
    
    // Set appropriate content type
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    
    // Set content type based on file extension
    const contentType = contentTypes[fileType] || 'application/octet-stream';
    
    // Check if this is a download request
    const isDownload = req.query.download === 'true';
    const forcePreview = req.query.forcePreview === 'true';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    
    // Set Content-Disposition based on request type
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(assignment.file_path)}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    // Add headers to allow embedding in iframe and prevent CSP issues
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:8080");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Everything checks out, send the file
    const absolutePath = path.resolve(assignment.file_path);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
    
    // Handle errors during streaming
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ message: 'Error streaming file' });
    });
  } catch (error) {
    console.error('Error in downloadAssignmentFile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId;
    const { notes } = req.body;
    let filePath = null;
    
    // If student uploads a file
    if (req.file) {
      filePath = req.file.path;
    }
    
    // Check if student is in the class
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    const studentClasses = await ClassStudent.getStudentClasses(userId);
    const isStudentInClass = studentClasses.some(c => c.id === assignment.class_id);
    
    if (!isStudentInClass) {
      return res.status(403).json({ message: 'You are not enrolled in this class' });
    }
    
    // Check if assignment deadline has passed
    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isLate = now > deadline;
    
    const submissionResult = await Submission.create({
      assignment_id: assignmentId,
      student_id: userId,
      file_path: filePath,
      notes,
      status: isLate ? 'late' : 'submitted'
    });
    
    res.json({
      message: 'Assignment submitted successfully',
      isLate,
      submission: {
        id: submissionResult.id,
        assignment_id: assignmentId,
        status: isLate ? 'late' : 'submitted'
      }
    });
  } catch (error) {
    console.error('Error in submitAssignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const submissionId = req.params.id;
    const userId = req.user.userId;
    const { grade, feedback } = req.body;
    
    // Validate grade is between 0-100
    if (grade < 0 || grade > 100) {
      return res.status(400).json({ message: 'Grade must be between 0 and 100' });
    }
    
    // Get submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Get assignment to check user permission
    const assignment = await Assignment.findById(submission.assignment_id);
    
    // Check if user has permission (owner or contributor)
    const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
    const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
    
    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'You do not have permission to grade submissions' });
    }
    
    await Submission.updateGrade(submissionId, { grade, feedback });
    
    res.json({
      message: 'Submission graded successfully',
      submission: {
        id: submissionId,
        grade,
        feedback,
        status: 'graded'
      }
    });
  } catch (error) {
    console.error('Error in gradeSubmission:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fungsi untuk mengambil file path yang benar
function getCorrectFilePath(filePath) {
  // Menghapus 'uploads\\' di awal path jika ada
  if (filePath && filePath.startsWith('uploads\\')) {
    return filePath.replace('uploads\\', '');
  }
  return filePath;
}

exports.downloadSubmissionFile = async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    console.log(`Download submission file request - Assignment: ${id}, Submission: ${submissionId}, User: ${userId}, Role: ${userRole}`);
    
    // Get submission
    const submission = await Submission.findById(submissionId);
    
    if (!submission) {
      console.log(`Submission not found: ${submissionId}`);
      return res.status(404).json({ message: 'Submission tidak ditemukan' });
    }
    
    console.log('Found submission:', JSON.stringify(submission, null, 2));

    // Get assignment
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      console.log(`Assignment not found: ${id}`);
      return res.status(404).json({ message: 'Assignment tidak ditemukan' });
    }
    
    console.log('Found assignment:', JSON.stringify(assignment, null, 2));

    // Check if user has access to this submission
    let hasAccess = false;
    
    if (userRole === 'teacher') {
      // Teachers: check if they own or contribute to the class
      const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
      const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
      hasAccess = isOwner || isContributor;
      
      console.log('Teacher access check:', { 
        userId,
        classId: assignment.class_id,
        isOwner, 
        isContributor, 
        hasAccess 
      });
    } else {
      // Students: check if it's their own submission
      hasAccess = parseInt(submission.student_id, 10) === parseInt(userId, 10);
      
      console.log('Student access check:', { 
        submissionStudentId: submission.student_id,
        userId,
        hasAccess
      });
    }
    
    if (!hasAccess) {
      console.log('Access denied for download submission file');
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk mengunduh file ini' });
    }

    // Check for submission file_path
    const submissionFilePath = submission.file_path || submission.filePath;
    
    if (!submissionFilePath) {
      console.log('No file to download - submission has no file path');
      return res.status(404).json({ message: 'Tidak ada file yang diupload' });
    }

    // Mendapatkan file path yang benar
    const fileNamePath = getCorrectFilePath(submissionFilePath);
    const filePath = path.join(__dirname, '..', '..', 'uploads', fileNamePath);
    console.log('File path:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('File not found at path:', filePath);
      return res.status(404).json({ message: 'File tidak ditemukan di server' });
    }

    // Set appropriate headers
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileNamePath)}"`);
    
    console.log('Streaming file for download:', filePath);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Terjadi kesalahan saat membaca file' });
      }
    });
    
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in downloadSubmissionFile:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Terjadi kesalahan saat mengunduh file',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

exports.previewSubmissionFile = async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    console.log(`Preview submission file request - Assignment: ${id}, Submission: ${submissionId}, User: ${userId}, Role: ${userRole}`);
    
    // Get submission
    const submission = await Submission.findById(submissionId);
    
    if (!submission) {
      console.log(`Submission not found: ${submissionId}`);
      return res.status(404).json({ message: 'Submission tidak ditemukan' });
    }
    
    console.log('Found submission:', JSON.stringify(submission, null, 2));

    // Get assignment
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      console.log(`Assignment not found: ${id}`);
      return res.status(404).json({ message: 'Assignment tidak ditemukan' });
    }
    
    console.log('Found assignment:', JSON.stringify(assignment, null, 2));

    // Check if user has access to this submission
    let hasAccess = false;
    
    if (userRole === 'teacher') {
      // Teachers: check if they own or contribute to the class
      const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
      const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);
      hasAccess = isOwner || isContributor;
      
      console.log('Teacher access check:', { 
        userId,
        classId: assignment.class_id,
        isOwner, 
        isContributor, 
        hasAccess 
      });
    } else {
      // Students: check if it's their own submission
      hasAccess = parseInt(submission.student_id, 10) === parseInt(userId, 10);
      
      console.log('Student access check:', { 
        submissionStudentId: submission.student_id,
        userId,
        hasAccess
      });
    }
    
    if (!hasAccess) {
      console.log('Access denied for preview submission file');
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk melihat file ini' });
    }

    // Check for submission file_path
    const submissionFilePath = submission.file_path || submission.filePath;
    
    if (!submissionFilePath) {
      console.log('No file to preview - submission has no file path');
      return res.status(404).json({ message: 'Tidak ada file yang diupload' });
    }

    // Mendapatkan file path yang benar
    const fileNamePath = getCorrectFilePath(submissionFilePath);
    const filePath = path.join(__dirname, '..', '..', 'uploads', fileNamePath);
    console.log('File path:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('File not found at path:', filePath);
      return res.status(404).json({ message: 'File tidak ditemukan di server' });
    }

    // Set appropriate headers
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileNamePath)}"`);
    
    console.log('Streaming file for preview:', filePath);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Terjadi kesalahan saat membaca file' });
      }
    });
    
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in previewSubmissionFile:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Terjadi kesalahan saat menampilkan file',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};