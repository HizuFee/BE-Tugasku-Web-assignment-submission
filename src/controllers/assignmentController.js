// src/controllers/assignmentController.js
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const ClassStudent = require('../models/ClassStudent');
const ClassContributor = require('../models/ClassContributor');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

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
    
    const assignment = await Assignment.create({
      class_id,
      title,
      description,
      deadline,
      created_by: userId
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
    
    await Assignment.update(assignmentId, { title, description, deadline });
    
    res.json({
      message: 'Assignment updated successfully',
      assignment: {
        id: assignmentId,
        title,
        description,
        deadline
      }
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
    
    await Assignment.delete(assignmentId);
    
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAssignment:', error);
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