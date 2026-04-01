const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Moved to the top for better performance

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

        // Send back the tokens AND the user's profile data
        res.status(201).json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        
        if (user && (await bcrypt.compare(password, user.password))) {
            const tokens = generateTokens(user._id);
            
            // Send back the tokens AND the user's profile data
            res.json({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};