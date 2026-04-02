const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true });

// 🔥 FIX: 'next' ko hamesha ke liye hata diya hai (Modern Mongoose Support)
userSchema.pre('save', async function () {
    // Agar password change nahi hua hai, to bas chup-chap wapas laut jao
    if (!this.isModified('password')) {
        return; 
    }
    // Agar naya password aaya hai, to usko encrypt (hash) karo
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);