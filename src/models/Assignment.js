// src/models/Assignment.js
const db = require('../config/database');

class Assignment {
  static async create(assignmentData) {
    const connection = await db.getConnection();
    
    try {
      const { class_id, title, description, deadline, created_by, file_path, selected_students } = assignmentData;
      
      // Start transaction
      await connection.beginTransaction();
      
      // Insert assignment
      const [result] = await connection.execute(
        'INSERT INTO assignments (class_id, title, description, deadline, created_by, file_path) VALUES (?, ?, ?, ?, ?, ?)',
        [class_id, title, description, deadline, created_by, file_path]
      );
      
      const assignmentId = result.insertId;

      // Insert selected students into assignment_students table
      if (selected_students && selected_students.length > 0) {
        const values = selected_students.map(studentId => [assignmentId, studentId]);
        await connection.query(
          'INSERT INTO assignment_students (assignment_id, student_id) VALUES ?',
          [values]
        );

        // Create pending submissions for selected students
        await connection.query(
          'INSERT INTO submissions (assignment_id, student_id, status) VALUES ?',
          [values.map(([assignId, studentId]) => [assignId, studentId, 'pending'])]
        );
      }

      // Commit transaction
      await connection.commit();
      
      return {
        id: assignmentId,
        ...assignmentData
      };
    } catch (error) {
      // Rollback in case of error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    try {
      // Get assignment details
      const [rows] = await db.execute(
        `SELECT a.*, u.name as creator_name 
         FROM assignments a
         JOIN users u ON a.created_by = u.id
         WHERE a.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      // Get selected students for this assignment
      const [students] = await db.execute(
        `SELECT u.id, u.name, u.email 
         FROM users u
         JOIN assignment_students ast ON u.id = ast.student_id
         WHERE ast.assignment_id = ?`,
        [id]
      );

      return {
        ...rows[0],
        selected_students: students
      };
    } catch (error) {
      throw error;
    }
  }

  static async findByClassId(classId, studentId = null) {
    try {
      let query = `
        SELECT a.*, u.name as creator_name 
        FROM assignments a
        JOIN users u ON a.created_by = u.id
      `;

      const params = [classId];

      // If studentId is provided, only get assignments assigned to this student
      if (studentId) {
        query += `
          JOIN assignment_students ast ON a.id = ast.assignment_id
          WHERE a.class_id = ? AND ast.student_id = ?
        `;
        params.push(studentId);
      } else {
        query += `WHERE a.class_id = ?`;
      }

      query += ` ORDER BY a.deadline ASC`;

      const [rows] = await db.execute(query, params);

      // If no studentId provided, also get the selected students for each assignment
      if (!studentId && rows.length > 0) {
        for (let assignment of rows) {
          const [students] = await db.execute(
            `SELECT u.id, u.name, u.email 
             FROM users u
             JOIN assignment_students ast ON u.id = ast.student_id
             WHERE ast.assignment_id = ?`,
            [assignment.id]
          );
          assignment.selected_students = students;
        }
      }

      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, { title, description, deadline, file_path, selected_students }) {
    const connection = await db.getConnection();
    
    try {
      console.log('Starting assignment update transaction...'); // Debug log
      
      // Start transaction
      await connection.beginTransaction();

      // Update assignment basic info
      let query = 'UPDATE assignments SET title = ?, description = ?, deadline = ?';
      let params = [title, description, deadline];
      
      // Only update file_path if provided
      if (file_path !== undefined) {
        query += ', file_path = ?';
        params.push(file_path);
      }
      
      query += ' WHERE id = ?';
      params.push(id);
      
      console.log('Updating assignment basic info:', { query, params }); // Debug log
      await connection.execute(query, params);

      // Update selected students if provided
      if (selected_students && Array.isArray(selected_students)) {
        console.log('Updating selected students:', selected_students); // Debug log

        // First, delete all existing assignment_students entries
        console.log('Deleting existing assignment_students...'); // Debug log
        await connection.execute(
          'DELETE FROM assignment_students WHERE assignment_id = ?',
          [id]
        );

        // Delete all existing submissions that haven't been submitted yet
        console.log('Deleting pending submissions...'); // Debug log
        await connection.execute(
          'DELETE FROM submissions WHERE assignment_id = ? AND status = ?',
          [id, 'pending']
        );

        if (selected_students.length > 0) {
          // Insert new assignment_students entries
          const values = selected_students.map(studentId => [id, studentId]);
          console.log('Inserting new assignment_students:', values); // Debug log
          await connection.query(
            'INSERT INTO assignment_students (assignment_id, student_id) VALUES ?',
            [values]
          );

          // Create new pending submissions for students who don't have a submission yet
          const submissionValues = [];
          for (const studentId of selected_students) {
            // Check if student already has a submission
            const [existingSubmission] = await connection.execute(
              'SELECT 1 FROM submissions WHERE assignment_id = ? AND student_id = ?',
              [id, studentId]
            );

            if (existingSubmission.length === 0) {
              submissionValues.push([id, studentId, 'pending']);
            }
          }

          if (submissionValues.length > 0) {
            console.log('Creating new pending submissions:', submissionValues); // Debug log
            await connection.query(
              'INSERT INTO submissions (assignment_id, student_id, status) VALUES ?',
              [submissionValues]
            );
          }
        }
      }

      // Commit transaction
      console.log('Committing transaction...'); // Debug log
      await connection.commit();
      return true;
    } catch (error) {
      // Rollback in case of error
      console.error('Error in update, rolling back:', error); // Debug log
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  static async delete(id) {
    try {
      // Start transaction
      await db.beginTransaction();
      
      try {
        // Delete assignment_students entries
        await db.execute(
          'DELETE FROM assignment_students WHERE assignment_id = ?',
          [id]
        );

        // Delete submissions
        await db.execute(
          'DELETE FROM submissions WHERE assignment_id = ?',
          [id]
        );

        // Delete assignment
        const [result] = await db.execute(
          'DELETE FROM assignments WHERE id = ?',
          [id]
        );

        // Commit transaction
        await db.commit();
        
        return { deleted: result.affectedRows > 0 };
      } catch (error) {
        // Rollback in case of error
        await db.rollback();
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
  
  static async getFilePath(id) {
    try {
      const [rows] = await db.execute(
        'SELECT file_path FROM assignments WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0].file_path : null;
    } catch (error) {
      throw error;
    }
  }

  static async isStudentAssigned(assignmentId, studentId) {
    try {
      const [rows] = await db.execute(
        'SELECT 1 FROM assignment_students WHERE assignment_id = ? AND student_id = ?',
        [assignmentId, studentId]
      );
      return rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Assignment;