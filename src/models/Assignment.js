// src/models/Assignment.js
const db = require('../config/database');

class Assignment {
  static async create(assignmentData) {
    try {
      const { class_id, title, description, deadline, created_by } = assignmentData;
      
      const [result] = await db.execute(
        'INSERT INTO assignments (class_id, title, description, deadline, created_by) VALUES (?, ?, ?, ?, ?)',
        [class_id, title, description, deadline, created_by]
      );
      
      return {
        id: result.insertId,
        ...assignmentData
      };
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM assignments WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  static async findByClassId(classId) {
    try {
      const [rows] = await db.execute(
        `SELECT a.*, u.name as creator_name 
         FROM assignments a
         JOIN users u ON a.created_by = u.id
         WHERE a.class_id = ?
         ORDER BY a.deadline ASC`,
        [classId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, { title, description, deadline }) {
    try {
      await db.execute(
        'UPDATE assignments SET title = ?, description = ?, deadline = ? WHERE id = ?',
        [title, description, deadline, id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }
  
  static async delete(id) {
    try {
      const [result] = await db.execute(
        'DELETE FROM assignments WHERE id = ?',
        [id]
      );
      return { deleted: result.affectedRows > 0 };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Assignment;