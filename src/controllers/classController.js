const Class = require('../models/Class');
const ClassStudent = require('../models/ClassStudent');
const ClassContributor = require('../models/ClassContributor');
const { validationResult } = require('express-validator');

exports.createClass = async (req, res) => {
  try {
    console.log('Create class request received:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can create classes' });
    }

    const { name, description } = req.body;
    const teacher_id = req.user.userId;

    const result = await Class.create({ name, description, teacher_id });
    
    // Add the creating teacher as owner in class_contributors
    await ClassContributor.join(result.id, teacher_id, 'owner');
    
    console.log('Class created with ID:', result.id, 'and code:', result.code);
    
    res.status(201).json({
      message: 'Class created successfully',
      classId: result.id,
      code: result.code
    });
  } catch (error) {
    console.error('Error in createClass:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyClasses = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    let classes = [];
    
    if (userRole === 'teacher') {
      // Get all classes where the teacher has any role (owner or contributor)
      // We'll make sure not to duplicate classes in the response
      const contributingClasses = await ClassContributor.getTeacherClasses(userId);
      
      // Create a map to track classes we've already added
      const classMap = new Map();
      
      // Add all contributor classes to the map
      contributingClasses.forEach(cls => {
        classMap.set(cls.id, cls);
      });
      
      // Convert the map back to an array
      classes = Array.from(classMap.values());
    } else if (userRole === 'student') {
      classes = await ClassStudent.getStudentClasses(userId);
    } else {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    res.json({ classes });
  } catch (error) {
    console.error('Error in getMyClasses:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.joinClass = async (req, res) => {
  try {
    console.log('Join class request received:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Find class by code
    const classData = await Class.findByCode(code);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found. Invalid code.' });
    }

    let result;
    // Different behavior based on the user's role
    if (userRole === 'student') {
      // Student joining a class
      result = await ClassStudent.join(classData.id, userId);
    } else if (userRole === 'teacher') {
      // Teacher joining as a contributor
      // Check if teacher is already the owner
      if (classData.teacher_id === userId) {
        return res.status(400).json({ message: 'You are already the owner of this class' });
      }
      
      result = await ClassContributor.join(classData.id, userId, 'contributor');
    } else {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    if (!result.joined) {
      return res.status(400).json({ message: result.message });
    }
    
    res.status(200).json({
      message: `Successfully joined the class as ${userRole === 'teacher' ? 'a contributor' : 'a student'}`,
      class: {
        id: classData.id,
        name: classData.name,
        description: classData.description
      }
    });
  } catch (error) {
    console.error('Error in joinClass:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getClassDetails = async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if user has access to this class
    if (userRole === 'teacher') {
      // For teachers, check if they're either the owner or a contributor
      const isOwner = classData.teacher_id === userId;
      const isContributor = await ClassContributor.isContributor(classId, userId);
      
      if (!isOwner && !isContributor) {
        return res.status(403).json({ message: 'You do not have access to this class' });
      }
      
      // Add role information
      classData.userRole = isOwner ? 'owner' : 'contributor';
    } else if (userRole === 'student') {
      // Check if student is enrolled in this class
      const studentClasses = await ClassStudent.getStudentClasses(userId);
      const isEnrolled = studentClasses.some(cls => cls.id === parseInt(classId));
      if (!isEnrolled) {
        return res.status(403).json({ message: 'You are not enrolled in this class' });
      }
      
      classData.userRole = 'student';
    }
    
    // Get students in the class
    const students = await ClassStudent.getClassStudents(classId);
    
    // Get contributors (teachers) in the class
    const contributors = await ClassContributor.getClassContributors(classId);
    
    res.json({
      class: classData,
      students,
      contributors
    });
  } catch (error) {
    console.error('Error in getClassDetails:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.userId;
    const { name, description } = req.body;
    
    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if user is the owner of this class
    const isOwner = await ClassContributor.isOwner(classId, userId);
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the class owner can update this class' });
    }
    
    // Update class
    await Class.update(classId, { name, description });
    
    res.json({ 
      message: 'Class updated successfully',
      class: {
        id: classId,
        name,
        description
      }
    });
  } catch (error) {
    console.error('Error in updateClass:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.userId;
    
    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if user is the owner of this class
    const isOwner = await ClassContributor.isOwner(classId, userId);
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the class owner can delete this class' });
    }
    
    // Delete class
    await Class.delete(classId);
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error in deleteClass:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.leaveClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    let result;
    
    if (userRole === 'student') {
      // Student leaving a class
      result = await ClassStudent.leave(classId, userId);
    } else if (userRole === 'teacher') {
      // Teacher leaving as a contributor
      result = await ClassContributor.leave(classId, userId);
    } else {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    if (!result.left) {
      return res.status(400).json({ message: result.message });
    }
    
    res.status(200).json({
      message: `Successfully left the class`,
      class: {
        id: classId,
        name: classData.name
      }
    });
  } catch (error) {
    console.error('Error in leaveClass:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.kickStudent = async (req, res) => {
  try {
    const classId = req.params.id;
    const studentId = req.params.studentId;
    const teacherId = req.user.userId;
    
    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can kick students from classes' });
    }
    
    // Kick student from class
    const result = await ClassContributor.kickStudent(classId, teacherId, studentId);
    
    if (!result.kicked) {
      return res.status(400).json({ message: result.message });
    }
    
    res.status(200).json({
      message: 'Student successfully removed from the class',
      class: {
        id: classId,
        name: classData.name
      }
    });
  } catch (error) {
    console.error('Error in kickStudent:', error);
    res.status(500).json({ message: 'Server error' });
  }
};