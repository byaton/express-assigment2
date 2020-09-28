const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
const jwt  = require('jsonwebtoken');
const User = require('../models/user');

exports.signup = (req, res, next) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
        const err = new Error('Validation failed!');
        err.statusCode = 422;
        err.data = error.array();
        throw err;
    }
    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;
    bcrypt.hash(password, 12).then(hashedPw => {
        const user = new User({
            email: email,
            password: hashedPw,
            name: name
        });
        return user.save();
    }).then(result => {
        res.status(201).json({message: 'new user created!', userId: result._id});
    }).catch(err => {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    });

}

exports.login = (req, res, next) => {
    email = req.body.email;
    password = req.body.password;
    let loadedUser;
    User.findOne({email: email})
        .then(user => {
            if (!user) {
                const error = new Error('A user with this password could not be found.');
                error.statusCode = 500;
                throw error;
            }
            loadedUser = user;
            return bcrypt.compare(password, loadedUser.password)
        }).then(isEqual => {
            if (!isEqual) {
                const error = new Error('A wrong password has been entered');
                error.statusCode = 401;
                throw error;
            }
            const token = jwt.sign({
                email: loadedUser.email,
                userId: loadedUser._id.toString()
            }, 'SecretKeyForAmitRoy', {
                expiresIn: 60*10
            });
            res.status(200).json({token: token, userId: loadedUser._id.toString()});
        }).catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500
            }
            next(err);
        });

}