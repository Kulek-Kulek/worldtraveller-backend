const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');


// const DUMMY_USERS = [
//     {
//         id: 'u1',
//         name: 'Max',
//         email: 'test@test.pl',
//         password: 'test'
//     }
// ]

const getUsers = async (req, res, next) => {
    let users;
    try {
        users = await User.find({}, '-password');
    } catch (err) {
        const error = new HttpError('Fetching users failed', 500);
    };

    res.json({ users: users.map(user => user.toObject({ getters: true })) });
};


const signup = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new HttpError('Invalid inputs!!', 422);
        return next(error);
    };

    const { name, email, password } = req.body;

    let existingUser;
    try {
        existingUser = await User.findOne({ email: email });
    } catch (err) {
        const error = new HttpError('Signing up failed.', 500);
        return next(error);
    };

    if (existingUser) {
        const error = new HttpError('Such user already exists', 422);
        return next(error);
    };


    let hashedPassword;

    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        const error = new HttpError('Could not create a user.', 500);
        return next(error);
    }

    const createdUser = new User({
        name,
        email,
        image: req.file.path,
        password: hashedPassword,
        places: []
    });

    try {
        await createdUser.save();
    } catch (err) {
        const error = new HttpError(
            'Signing up failed', 500);
        return next(error);
    };

    let token;

    try {
        token = jwt.sign(
            { userId: createdUser.id, email: createdUser.email },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );
    } catch (err) {
        const error = new HttpError(
            'Signing up failed', 500);
        return next(error);
    }

    res.status(201).json(
        {
            userId: createdUser.id,
            email: createdUser.email,
            token: token
        });
};


const login = async (req, res, next) => {
    const { email, password } = req.body;

    let existingUser;
    try {
        existingUser = await User.findOne({ email: email });
    } catch (err) {
        const error = new HttpError('Loggin in failed.', 500);
        return next(error);
    };

    if (!existingUser) {
        const error = new HttpError('Invaliid credentials.', 401);
        return next(error);
    }

    let isValidPassword;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        const error = new HttpError('Couldn not log you in!', 500);
        return next(error);
    }

    if (!isValidPassword) {
        const error = new HttpError('Invaliid credentials.', 403);
        return next(error);
    }


    let token;

    try {
        token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );
    } catch (err) {
        const error = new HttpError(
            'Logging in failed', 500);
        return next(error);
    }

    res.json({
        userId: existingUser.id,
        email: existingUser.email,
        token: token
    })
};


exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;