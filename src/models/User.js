// src/models/User.js
const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findById(id) {
    try {
      console.log('User.findById called with id:', id, 'type:', typeof id);
      
      // Jika id undefined atau null, return null
      if (id === undefined || id === null) {
        console.error('findById called with null/undefined id');
        return null;
      }
      
      const userId = parseInt(id, 10);
      if (isNaN(userId)) {
        console.error('Invalid user ID (not a number):', id);
        return null;
      }
      
      console.log('Executing User.findById query with:', userId);
      const [rows] = await db.execute(
        'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?', 
        [userId]
      );
      
      const user = rows[0] || null;
      console.log('User.findById result:', user ? `Found user ${user.id}` : 'No user found');
      
      return user;
    } catch (error) {
      console.error('Error in User.findById:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async create(userData) {
    const { name, email, password, role } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const [result] = await db.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;