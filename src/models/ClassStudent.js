// src/models/ClassStudent.js
const db = require('../config/database');

class ClassStudent {
  static async join(classId, studentId) {
    try {
      // Check if student is already in this class
      const [existing] = await db.execute(
        'SELECT * FROM class_students WHERE class_id = ? AND student_id = ?',
        [classId, studentId]
      );

      if (existing.length > 0) {
        return { joined: false, message: 'You are already enrolled in this class' };
      }

      const [result] = await db.execute(
        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
        [classId, studentId]
      );
      
      return { joined: true, id: result.insertId };
    } catch (error) {
      throw error;
    }
  }

  static async leave(classId, studentId) {
    try {
      // Check if student is in this class
      const [existing] = await db.execute(
        'SELECT * FROM class_students WHERE class_id = ? AND student_id = ?',
        [classId, studentId]
      );

      if (existing.length === 0) {
        return { left: false, message: 'You are not enrolled in this class' };
      }

      const [result] = await db.execute(
        'DELETE FROM class_students WHERE class_id = ? AND student_id = ?',
        [classId, studentId]
      );
      
      return { left: true, affectedRows: result.affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async getClassStudents(classId) {
    try {
      const [rows] = await db.execute(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN class_students cs ON u.id = cs.student_id
         WHERE cs.class_id = ?`,
        [classId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getStudentClasses(studentId) {
    try {
      const [rows] = await db.execute(
        `SELECT c.* FROM classes c
         JOIN class_students cs ON c.id = cs.class_id
         WHERE cs.student_id = ?`,
        [studentId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ClassStudent;