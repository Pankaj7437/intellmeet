const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { registerUser, loginUser, updateProfile, updatePassword } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);

module.exports = router;