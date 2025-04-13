const db = require('../config/database');

class Topic {
  static async create({ name, description, class_id, created_by }) {
    try {
      const [result] = await db.execute(
        'INSERT INTO topics (name, description, class_id, created_by) VALUES (?, ?, ?, ?)',
        [name, description, class_id, created_by]
      );
      
      return {
        id: result.insertId,
        name,
        description,
        class_id,
        created_by
      };
    } catch (error) {
      throw error;
    }
  }

  static async findByClassId(classId) {
    try {
      const [rows] = await db.execute(
        `SELECT t.*, u.name as creator_name 
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.class_id = ? 
         ORDER BY t.name ASC`,
        [classId]
      );
      return rows;
    } catch (error) {
      console.error('Error in Topic.findByClassId:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM topics WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, { name, description }) {
    try {
      await db.execute(
        'UPDATE topics SET name = ?, description = ? WHERE id = ?',
        [name, description, id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      await db.execute(
        'DELETE FROM topics WHERE id = ?',
        [id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async assignToAssignment(assignmentId, topicIds) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Hapus topik yang ada untuk assignment ini
      await connection.execute(
        'DELETE FROM assignment_topics WHERE assignment_id = ?',
        [assignmentId]
      );

      // Tambahkan topik baru
      if (topicIds && topicIds.length > 0) {
        const values = topicIds.map(topicId => [assignmentId, topicId]);
        await connection.query(
          'INSERT INTO assignment_topics (assignment_id, topic_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAssignmentTopics(assignmentId) {
    try {
      const [rows] = await db.execute(
        `SELECT t.* FROM topics t
         JOIN assignment_topics at ON t.id = at.topic_id
         WHERE at.assignment_id = ?`,
        [assignmentId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Topic; 