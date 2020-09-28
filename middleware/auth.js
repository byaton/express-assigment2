const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
        // const error = new Error('The user can not be authenticated!');
        // error.statusCode = 401;
        // throw error;
        req.isAuth = false;
        return next();
    }
    const token = authHeader.split(' ')[1];
    let decodedToken;
    try {
        decodedToken = jwt.verify(token, 'SecretKeyForAmitRoy');
    } catch(err) {
        // err.statusCode = 500;
        // throw err;
        req.isAuth = false;
        return next();
    }
    if (!decodedToken) {
        // const error = new Error('The user could not be authenticated!');
        // error.statusCode = 401;
        // throw error;
        req.isAuth = false;
        return next();
    }
    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();
}