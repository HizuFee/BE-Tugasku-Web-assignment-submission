const db = require('../config/database');

class ClassContributor {
  static async join(classId, teacherId, role = 'contributor') {
    try {
      // Check if teacher is already a contributor to this class
      const [existing] = await db.execute(
        'SELECT * FROM class_contributors WHERE class_id = ? AND teacher_id = ?',
        [classId, teacherId]
      );

      if (existing.length > 0) {
        return { joined: false, message: 'You are already a contributor in this class' };
      }

      const [result] = await db.execute(
        'INSERT INTO class_contributors (class_id, teacher_id, role) VALUES (?, ?, ?)',
        [classId, teacherId, role]
      );
      
      return { joined: true, id: result.insertId };
    } catch (error) {
      throw error;
    }
  }

  static async getClassContributors(classId) {
    try {
      const [rows] = await db.execute(
        `SELECT u.id, u.name, u.email, cc.role FROM users u
         JOIN class_contributors cc ON u.id = cc.teacher_id
         WHERE cc.class_id = ?`,
        [classId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getTeacherClasses(teacherId) {
    try {
      // This query gets both classes where teacher is owner AND contributor
      const [rows] = await db.execute(
        `SELECT c.*, 
          CASE 
            WHEN c.teacher_id = ? THEN 'owner' 
            ELSE cc.role 
          END as role 
        FROM classes c
        LEFT JOIN class_contributors cc ON c.id = cc.class_id
        WHERE c.teacher_id = ? OR (cc.teacher_id = ? AND cc.class_id = c.id)`,
        [teacherId, teacherId, teacherId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async isContributor(classId, teacherId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM class_contributors WHERE class_id = ? AND teacher_id = ?',
        [classId, teacherId]
      );
      return rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ClassContributor;