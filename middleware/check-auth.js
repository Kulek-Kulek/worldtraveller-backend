const HttpError = require('../models/http-error');
const jwt = require('jsonwebtoken');


module.exports = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        const token = req.headers.authorization.split(' ')[1]; //dlatego, że Authorization: 'Bearer Token' bo taki przyjdzie z frontendu

        if (!token) {
            throw new Error('Authorization failed.');
        }

        const decodedToken = jwt.verify(token, process.env.JWT_KEY);
        req.userData = { userId: decodedToken.userId }

        next();

    } catch (err) {
        const error = new HttpError('Authorization failed!!', 403);
        return next(error);
    }
};