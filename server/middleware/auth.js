/**
 * Authentication & Authorization Middleware
 */
const jwt = require('jsonwebtoken');

/**
 * Middleware: Verify JWT Token
 * Checks if the user has a valid token before allowing access to protected routes.
 */
const verifyToken = (req, res, next) => {
    // Get token from headers (supports standard authorization and custom headers)
    let token = req.headers['authorization'] || req.headers['x-access-token'];

    if (!token) {
        return res.status(403).json({ success: false, message: "A token is required for authentication" });
    }

    try {
        // Safely extract the token if it uses the "Bearer" scheme
        if (token.startsWith('Bearer ')) {
            token = token.slice(7).trim(); 
        }

        const secretKey = process.env.JWT_SECRET;
        
        // Verify token and attach the decoded user info to the request
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;

    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired Token" });
    }
    
    return next();
};

/**
 * Middleware: Role-Based Access Control (RBAC)
 * Must be placed AFTER verifyToken in the route definition.
 * @param {Array<string>} allowedRoles - Array of roles permitted to access the route.
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        
        // Fallback to basic 'user' role if none is defined
        const userRole = req.user.role || 'user';
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ success: false, message: "Access denied: Insufficient permissions" });
        }
        
        next();
    };
};

module.exports = { verifyToken, checkRole };