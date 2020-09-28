const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');;
module.exports = {
    // hello() {
    //     return {
    //         text: 'Hello World!',
    //         views: 12345
    //     };
    // }
    createUser: async function({userInput}, req) {
        const errors = [];
        
        if (!validator.isEmail(userInput.email)) {
            errors.push({message: 'The EMail is not valid'});
        }
        if (validator.isEmpty(userInput.password) || !validator.isLength(userInput.password, {min: 5})) {
            errors.push({message: 'The password is too short'});
        }
        if (errors.length > 0) {
            const err = new Error('The input is not correct');
            err.errorMessages = errors;
            err.statusCode = 422;
            throw err;
        }
        const existingUser = await User.findOne({email: userInput.email});
        if (existingUser) {
            const error = new Error('User already exists');
            throw error;
        }
        const hashedPw = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            email: userInput.email,
            password: hashedPw,
            name: userInput.name
        });
        const createdUser = await user.save();
        return {...createdUser._doc, _id: createdUser._id.toString()};
    },
    login: async function({email, password}) {
        const user = await User.findOne({email: email});
        if (!user) {
            const err = new Error('No user was found with the given name');
            err.statusCode = 401;
            throw err;
        }
        const isEqual = await bcrypt.compare(password, user.password);

        if (!isEqual) {
            const err = new Error('The Password is incorrect');
            err.statusCode = 401;
            throw err;
        }

        const token = jwt.sign({
            email: email,
            userId: user._id.toString()
        }, 'SecretKeyForAmitRoy', {
            expiresIn: 60*10
        });

        return {
            token: token,
            userId: user._id.toString()
        };
    },
    createPost: async function({postInput}, req) {
        if (!req.isAuth) {
            const err = new Error('The user is not authenticated!');
            err.statusCode = 401;
            throw err;
        }
        const errors = [];
        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
            errors.push({message: 'The title is not valid'});
        }

        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
            errors.push({message : 'The Content is invalid'});
        }

        if (errors.length > 0) {           
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        const user = await User.findById(req.userId);
        
        if (!user) {
            const error = new Error('The user does not exist');
            error.code = 401;
            throw error;
        }        
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        
        user.posts.push(createdPost);
        await user.save();
        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };

    },
    posts: async function({page}, req) {
        if (!page) {
            page = 1;
        }
        const perPage = 2;
        const totalPosts = await Post.find().countDocuments();
        const post = await Post.find()
                               .sort({createdAt: -1})
                               .skip((page - 1)*perPage)
                               .limit(perPage)
                               .populate('creator');
        return {
            posts: post.map(p => {
                return {
                    ...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString()
                };
            }),
            totalPosts: totalPosts
        }
    },
    singlePost: async function({postId}, req) {
        if (!req.isAuth) {
            const err = new Error('The user is not authenticated!');
            err.statusCode = 401;
            throw err;
        }

        if (!postId) {
            const err = new Error('The Post id is not available');
            err.statusCode = 422;
            throw err;
        }

        // const post = await Post.findOne(mongoose.Types.ObjectId(postId));
        const post = await Post.findById(postId).populate('creator');
        
        if (!post) {
            const err = new Error('No data found against this post id');
            err.statusCode = 400;
            throw err;
        }
        
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        };
    },
    editPost: async function({postId, postInput}, req) {
        if (!req.isAuth) {
            const err = new Error('The user is not authenticated to edit a Post');
            err.statusCode = 402;
            throw err;
        }        
        
        const errors = [];
        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
            errors.push({message: 'The title either does not have any text or meet with the minimunm length criteria'});
        }
        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
            errors.push({message: 'The content either does not have any text or meet with the minimunm length criteria'});
        }

        if (errors.length > 0) {
            const err = new Error('The input is not valid');
            err.statusCode = 402;
            err.data = errors;
            throw err;
        }

        const post = await Post.findById(postId).populate('creator');
        
        if (!post) {
            const err = new Error('No data found');
            err.statusCode = 404;
            throw err;
        }

        if (post.creator._id.toString() !== req.userId.toString()) {
            const err = new Error('The user is not authorized to edit the post');
            err.statusCode = 403;
            throw err;
        }

        post.title = postInput.title;
        post.content = postInput.content;
        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = postInput.imageUrl;
        }

        const updatedPost = await post.save();

        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        };

    },
    deletePost: async function({postId}, req) {
        if (!req.isAuth) {
            const err = new Error('The user is not authenticated');
            err.statusCode = 401;
            throw err;
        }
        const post = await Post.findById(postId).populate('creator');
        if (!post) {
            const err = new Error('No post found against this ID');
            err.statusCode = 402;
            throw err;
        }
        
        if (post.creator._id.toString() !== req.userId) {
            const err = new Error('Ths User is not authenticated to delete the post');
            err.statusCode = 402;
            throw err;
        }

        await Post.findByIdAndRemove(postId);
        const user =  await User.findById(post.creator._id.toString());
        await user.posts.pull(postId);
        await user.save();

        return {
            ...post._doc,
            _id: postId,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        };
    }
};