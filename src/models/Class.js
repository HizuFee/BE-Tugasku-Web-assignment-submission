// src/models/Class.js
const db = require('../config/database');
// const { v4: uuidv4 } = require('uuid');

class Class {
  static async create({ name, description, teacher_id }) {
    try {
      // Generate a unique 6-character code
      const code = await this.generateUniqueCode();
      
      const [result] = await db.execute(
        'INSERT INTO classes (name, description, teacher_id, code) VALUES (?, ?, ?, ?)',
        [name, description, teacher_id, code]
      );
      
      return {
        id: result.insertId,
        code
      };
    } catch (error) {
      throw error;
    }
  }

  static async generateUniqueCode() {
    // Generate a 6-character alphanumeric code
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      // Generate random 6-char alphanumeric code
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Check if code already exists
      const [existing] = await db.execute(
        'SELECT * FROM classes WHERE code = ?',
        [code]
      );
      
      if (existing.length === 0) {
        isUnique = true;
      }
    }
    
    return code;
  }

  static async findByTeacherId(teacherId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM classes WHERE teacher_id = ?',
        [teacherId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async findByCode(code) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM classes WHERE code = ?',
        [code]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM classes WHERE id = ?',
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
        'UPDATE classes SET name = ?, description = ? WHERE id = ?',
        [name, description, id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }
  
  static async delete(id) {
    try {
      // Hapus dulu semua kontributor kelas
      const ClassContributor = require('./ClassContributor');
      await ClassContributor.deleteByClassId(id);
      
      // Setelah itu baru hapus kelas
      const [result] = await db.execute(
        'DELETE FROM classes WHERE id = ?',
        [id]
      );
      return { deleted: result.affectedRows > 0 };
    } catch (error) {
      throw error;
    }
  }
}


module.exports = Class;