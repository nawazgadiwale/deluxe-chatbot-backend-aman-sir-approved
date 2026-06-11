const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access token required.",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found.",
            });
        }

        if (user.disabled) {
            return res.status(403).json({
                success: false,
                message: "Your account has been disabled. Please contact the administrator.",
            });
        }

        req.user = user;

        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
};

module.exports = authenticateToken;