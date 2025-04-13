const Topic = require('../models/Topic');
const ClassContributor = require('../models/ClassContributor');
const { validationResult } = require('express-validator');

exports.createTopic = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, class_id } = req.body;
    const userId = req.user.userId;

    // Verifikasi akses ke kelas
    const isOwner = await ClassContributor.isOwner(class_id, userId);
    const isContributor = await ClassContributor.isContributor(class_id, userId);

    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk membuat topik di kelas ini' });
    }

    const topic = await Topic.create({
      name,
      description,
      class_id,
      created_by: userId
    });

    res.status(201).json({
      message: 'Topik berhasil dibuat',
      topic
    });
  } catch (error) {
    console.error('Error in createTopic:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

exports.getClassTopics = async (req, res) => {
  try {
    const classId = req.params.classId;
    const userId = req.user.userId;

    // Verifikasi akses ke kelas
    const isOwner = await ClassContributor.isOwner(classId, userId);
    const isContributor = await ClassContributor.isContributor(classId, userId);

    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke kelas ini' });
    }

    const topics = await Topic.findByClassId(classId);
    res.json({ topics });
  } catch (error) {
    console.error('Error in getClassTopics:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

exports.updateTopic = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const topicId = req.params.id;
    const { name, description } = req.body;
    const userId = req.user.userId;

    // Dapatkan topic untuk verifikasi
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topik tidak ditemukan' });
    }

    // Verifikasi akses
    const isOwner = await ClassContributor.isOwner(topic.class_id, userId);
    const isContributor = await ClassContributor.isContributor(topic.class_id, userId);

    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk mengubah topik ini' });
    }

    await Topic.update(topicId, { name, description });

    res.json({
      message: 'Topik berhasil diperbarui',
      topic: {
        id: topicId,
        name,
        description
      }
    });
  } catch (error) {
    console.error('Error in updateTopic:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    const topicId = req.params.id;
    const userId = req.user.userId;

    // Dapatkan topic untuk verifikasi
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topik tidak ditemukan' });
    }

    // Verifikasi akses
    const isOwner = await ClassContributor.isOwner(topic.class_id, userId);
    const isContributor = await ClassContributor.isContributor(topic.class_id, userId);

    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk menghapus topik ini' });
    }

    await Topic.delete(topicId);

    res.json({ message: 'Topik berhasil dihapus' });
  } catch (error) {
    console.error('Error in deleteTopic:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

exports.assignTopicsToAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { topic_ids } = req.body;
    const userId = req.user.userId;

    // Verifikasi akses ke assignment
    const Assignment = require('../models/Assignment');
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Tugas tidak ditemukan' });
    }

    const isOwner = await ClassContributor.isOwner(assignment.class_id, userId);
    const isContributor = await ClassContributor.isContributor(assignment.class_id, userId);

    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk mengatur topik tugas ini' });
    }

    await Topic.assignToAssignment(assignmentId, topic_ids);

    res.json({ message: 'Topik berhasil ditambahkan ke tugas' });
  } catch (error) {
    console.error('Error in assignTopicsToAssignment:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

exports.getAssignmentTopics = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const topics = await Topic.getAssignmentTopics(assignmentId);
    res.json({ topics });
  } catch (error) {
    console.error('Error in getAssignmentTopics:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
}; 