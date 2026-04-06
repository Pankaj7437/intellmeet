const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); 

const generateTokens = (id) => {
    const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User exists' });

        const user = await User.create({ name, email, password });
        const tokens = generateTokens(user._id);

        res.status(201).json({
            token: tokens.accessToken,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: { _id: user._id, name: user.name, email: user.email }
        });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && (await bcrypt.compare(password, user.password))) {
            const tokens = generateTokens(user._id);
            res.json({
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { _id: user._id, name: user.name, email: user.email }
            });
        } else { res.status(401).json({ message: 'Invalid credentials' }); }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            const updatedUser = await user.save();
            res.json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email });
        } else { res.status(404).json({ message: 'User not found' }); }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (user && (await bcrypt.compare(currentPassword, user.password))) {
            
            user.password = newPassword; 
            await user.save();
            
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Incorrect current password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};