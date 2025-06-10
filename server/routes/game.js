const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find()
      .sort({ wins: -1 })
      .limit(10)
      .select('username wins losses draws');

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('username wins losses draws');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;