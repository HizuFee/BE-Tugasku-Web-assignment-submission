// src/models/Assignment.js
const db = require('../config/database');

class Assignment {
  static async create(assignmentData) {
    const connection = await db.getConnection();
    
    try {
      const { class_id, title, description, deadline, created_by, file_path, selected_students, selected_topics } = assignmentData;
      
      console.log('Creating assignment with data:', {
        class_id, title, description, deadline, created_by,
        selected_students_count: selected_students?.length,
        selected_topics_count: selected_topics?.length
      });

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

      // Insert selected topics into assignment_topics table
      if (selected_topics && selected_topics.length > 0) {
        console.log('Inserting topics:', selected_topics);
        const topicValues = selected_topics.map(topicId => [assignmentId, parseInt(topicId)]);
        await connection.query(
          'INSERT INTO assignment_topics (assignment_id, topic_id) VALUES ?',
          [topicValues]
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
      console.error('Error in Assignment.create:', error);
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    const [assignments] = await db.execute(`
        SELECT 
            a.*,
            GROUP_CONCAT(DISTINCT s.student_id) as selected_students,
            GROUP_CONCAT(DISTINCT t.topic_id) as selected_topics
        FROM assignments a
        LEFT JOIN assignment_students s ON a.id = s.assignment_id
        LEFT JOIN assignment_topics t ON a.id = t.assignment_id
        WHERE a.id = ?
        GROUP BY a.id
    `, [id]);

    if (assignments.length === 0) {
        return null;
    }

    const assignment = assignments[0];
    
    // Convert selected_students string to array of integers
    assignment.selected_students = assignment.selected_students 
        ? assignment.selected_students.split(',').map(Number)
        : [];

    // Convert selected_topics string to array of integers
    assignment.selected_topics = assignment.selected_topics
        ? assignment.selected_topics.split(',').map(Number)
        : [];

    return assignment;
  }

  static async findByClassId(classId, studentId = null) {
    try {
      let query = `
        SELECT DISTINCT a.*, u.name as creator_name,
        GROUP_CONCAT(DISTINCT t.id) as topic_ids,
        GROUP_CONCAT(DISTINCT t.name) as topic_names
        FROM assignments a
        JOIN users u ON a.created_by = u.id
        LEFT JOIN assignment_topics at ON a.id = at.assignment_id
        LEFT JOIN topics t ON at.topic_id = t.id
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

      query += ` GROUP BY a.id ORDER BY a.deadline ASC`;

      const [rows] = await db.execute(query, params);

      // Process the results to format topics
      const assignments = rows.map(row => {
        const topics = row.topic_ids ? 
          row.topic_ids.split(',').map((id, index) => ({
            id: parseInt(id),
            name: row.topic_names.split(',')[index]
          })) : [];

        delete row.topic_ids;
        delete row.topic_names;

        return {
          ...row,
          topics
        };
      });

      // If no studentId provided, also get the selected students for each assignment
      if (!studentId && assignments.length > 0) {
        for (let assignment of assignments) {
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

      return assignments;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, { title, description, deadline, file_path, selected_students, selected_topics }) {
    const connection = await db.getConnection();
    
    try {
        console.log('Updating assignment with data:', {
            id,
            title,
            description,
            deadline,
            file_path,
            selected_students_count: selected_students?.length,
            selected_topics_count: selected_topics?.length
        });

        await connection.beginTransaction();

        // Update basic assignment data
        const updateData = [title, description, deadline];
        let updateQuery = 'UPDATE assignments SET title = ?, description = ?, deadline = ?';
        
        // Only include file_path in update if it's provided
        if (file_path !== undefined) {
            updateQuery += ', file_path = ?';
            updateData.push(file_path);
        }
        
        updateQuery += ' WHERE id = ?';
        updateData.push(id);

        await connection.execute(updateQuery, updateData);

        // Delete existing assignment_students and pending submissions
        await connection.execute('DELETE FROM submissions WHERE assignment_id = ? AND status = ?', [id, 'pending']);
        await connection.execute('DELETE FROM assignment_students WHERE assignment_id = ?', [id]);

        // Insert new assignment_students and create pending submissions
        if (selected_students && selected_students.length > 0) {
            console.log('Inserting selected students:', selected_students);
            const studentValues = selected_students.map(studentId => [id, parseInt(studentId)]);
            await connection.query(
                'INSERT INTO assignment_students (assignment_id, student_id) VALUES ?',
                [studentValues]
            );

            // Create pending submissions for new students
            await connection.query(
                'INSERT INTO submissions (assignment_id, student_id, status) VALUES ?',
                [studentValues.map(([assignId, studentId]) => [assignId, studentId, 'pending'])]
            );
        }

        // Delete existing assignment_topics
        await connection.execute('DELETE FROM assignment_topics WHERE assignment_id = ?', [id]);

        // Insert new assignment_topics
        if (selected_topics && selected_topics.length > 0) {
            console.log('Inserting selected topics:', selected_topics);
            const topicValues = selected_topics.map(topicId => [id, parseInt(topicId)]);
            await connection.query(
                'INSERT INTO assignment_topics (assignment_id, topic_id) VALUES ?',
                [topicValues]
            );
        }

        await connection.commit();
        console.log('Assignment update completed successfully');
        
        // Return updated assignment
        return await this.findById(id);
    } catch (error) {
        await connection.rollback();
        console.error('Error in Assignment.update:', error);
        throw error;
    } finally {
        connection.release();
    }
  }
  
  static async delete(id) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Delete assignment_students entries
        await connection.execute(
            'DELETE FROM assignment_students WHERE assignment_id = ?',
            [id]
        );

        // Delete submissions
        await connection.execute(
            'DELETE FROM submissions WHERE assignment_id = ?',
            [id]
        );

        // Delete assignment_topics
        await connection.execute(
            'DELETE FROM assignment_topics WHERE assignment_id = ?',
            [id]
        );

        // Delete assignment
        const [result] = await connection.execute(
            'DELETE FROM assignments WHERE id = ?',
            [id]
        );

        await connection.commit();
        return { deleted: result.affectedRows > 0 };
    } catch (error) {
        await connection.rollback();
        console.error('Error in Assignment.delete:', error);
        throw error;
    } finally {
        connection.release();
    }
  }
  
  static async getFilePath(id) {
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT file_path FROM assignments WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0].file_path : null;
    } catch (error) {
      console.error('Error in Assignment.getFilePath:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async isStudentAssigned(assignmentId, studentId) {
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT 1 FROM assignment_students WHERE assignment_id = ? AND student_id = ?',
        [assignmentId, studentId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error in Assignment.isStudentAssigned:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async createWithTopicsAndStudents({
    class_id,
    title,
    description,
    deadline,
    file_path,
    created_by,
    selected_students,
    selected_topics
  }) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Create assignment
        const [result] = await connection.execute(
            'INSERT INTO assignments (class_id, title, description, deadline, file_path, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [class_id, title, description, deadline, file_path, created_by]
        );
        
        const assignmentId = result.insertId;

        // Insert assignment_students
        if (selected_students && selected_students.length > 0) {
            const studentValues = selected_students.map(studentId => [assignmentId, parseInt(studentId)]);
            await connection.query(
                'INSERT INTO assignment_students (assignment_id, student_id) VALUES ?',
                [studentValues]
            );

            // Create pending submissions for each student
            const submissionValues = selected_students.map(studentId => [assignmentId, parseInt(studentId), 'pending']);
            await connection.query(
                'INSERT INTO submissions (assignment_id, student_id, status) VALUES ?',
                [submissionValues]
            );
        }

        // Insert assignment_topics
        if (selected_topics && selected_topics.length > 0) {
            const topicValues = selected_topics.map(topicId => [assignmentId, parseInt(topicId)]);
            await connection.query(
                'INSERT INTO assignment_topics (assignment_id, topic_id) VALUES ?',
                [topicValues]
            );
        }

        await connection.commit();

        // Fetch complete assignment data
        return await this.findById(assignmentId);

    } catch (error) {
        await connection.rollback();
        console.error('Error in Assignment.createWithTopicsAndStudents:', error);
        throw error;
    } finally {
        connection.release();
    }
  }
}

module.exports = Assignment;