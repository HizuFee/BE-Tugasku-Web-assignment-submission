// src/models/Submission.js
const db = require('../config/database');

class Submission {
  static async create(submissionData) {
    try {
      const { assignment_id, student_id, file_path, notes } = submissionData;
      
      // Check if submission exists
      const existing = await this.findByAssignmentAndStudent(assignment_id, student_id);
      
      if (existing) {
        // Update existing submission
        await db.execute(
          'UPDATE submissions SET file_path = ?, notes = ?, status = ?, submitted_at = NOW() WHERE id = ?',
          [file_path, notes, 'submitted', existing.id]
        );
        return { id: existing.id, updated: true };
      } else {
        // Create new submission
        const [result] = await db.execute(
          'INSERT INTO submissions (assignment_id, student_id, file_path, notes, status, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [assignment_id, student_id, file_path, notes, 'submitted']
        );
        return { id: result.insertId, updated: false };
      }
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      console.log('Submission.findById called with id:', id);
      console.log('Type of id:', typeof id);

      // Convert id to number if it's a string
      const submissionId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      if (!submissionId || isNaN(submissionId)) {
        console.log('Invalid submission ID:', id);
        return null;
      }

      console.log('Executing submission query with ID:', submissionId);
      const [rows] = await db.execute(
        `SELECT s.*, u.name as student_name 
         FROM submissions s
         LEFT JOIN users u ON s.student_id = u.id
         WHERE s.id = ?`,
        [submissionId]
      );
      
      console.log('Submission query result:', rows[0] || 'No submission found');
      return rows[0] || null;
    } catch (error) {
      console.error('Error in Submission.findById:', error);
      throw error;
    }
  }

  static async findByAssignmentAndStudent(assignmentId, studentId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?',
        [assignmentId, studentId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  static async findByAssignmentId(assignmentId) {
    try {
      const [rows] = await db.execute(
        `SELECT s.*, u.name as student_name, u.email as student_email
         FROM submissions s
         JOIN users u ON s.student_id = u.id
         WHERE s.assignment_id = ?`,
        [assignmentId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async updateGrade(id, { grade, feedback }) {
    try {
      await db.execute(
        'UPDATE submissions SET grade = ?, feedback = ?, status = ?, graded_at = NOW() WHERE id = ?',
        [grade, feedback, 'graded', id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async getStudentSubmissions(studentId) {
    try {
      const [rows] = await db.execute(
        `SELECT s.*, a.title as assignment_title, a.deadline, c.name as class_name
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN classes c ON a.class_id = c.id
         WHERE s.student_id = ?`,
        [studentId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async initializeForAssignment(assignmentId, studentIds) {
    try {
      // For each student, create a pending submission if it doesn't exist
      for (const studentId of studentIds) {
        const existing = await this.findByAssignmentAndStudent(assignmentId, studentId);
        
        if (!existing) {
          await db.execute(
            'INSERT INTO submissions (assignment_id, student_id, status) VALUES (?, ?, ?)',
            [assignmentId, studentId, 'pending']
          );
        }
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Submission;