const mongoose = require('mongoose');
const { validationResult } = require('express-validator/check');
const fs = require('fs');
const path = require('path');
const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
    const curPage = req.query.page || 1;
    const perPage = 2;
    let totalItems = 0;

    try {
        totalItems = await Post.find().countDocuments();
        const posts = await Post.find().skip((curPage - 1)*perPage).limit(perPage);
        res.status(200).json({
            message: 'All the postst fetched successfully',
            posts: posts,
            totalItems: totalItems
        });            
    } catch (err) {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);        
    }



    // Post.find().countDocuments()
    //     .then(count => {
    //         totalItems = count;
    //         return Post.find().skip((curPage - 1)*perPage).limit(perPage);
    //     }).then(posts => {
    //         res.status(200).json({
    //             message: 'All the postst fetched successfully',
    //             posts: posts,
    //             totalItems: totalItems
    //         });
    //     }).catch(err => {
    //         if (!err.statusCode) {
    //             err.statusCode = 500;
    //         }
    //         next(err);
    //     });

}

exports.createPost = (req, res, next) => {    
    const error = validationResult(req);
    if (!error.isEmpty()) {
        const error = new Error('Validation failed, entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }
    
    if (!req.file) {
        const error = new Error('No image provided.');
        error.statusCode = 422;
        throw error;
    }
    let creator;
    const imageUrl = req.file.path;
    const title = req.body.title;
    const content = req.body.content;
    const post = new Post({
        title: title,
        imageUrl: imageUrl,
        content: content,
        creator: req.userId
    });
    post.save()
        .then(() => {
            return User.findById(req.userId);
        }).then(user => {
            creator = user;
            user.posts.push(post);
            return user.save();
        }).then(() => {
            io.getIO().emit('posts', {action: 'create', post: post});
            res.status(201).json({
                message: 'The post created successfully',
                post: post,
                creator: { _id: creator._id, name: creator.name}
            });            
        }).catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
}

exports.getPost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const err = new Error('The post was not found');
                err.statusCode = 404;
                throw err;
            }
            res.status(200).json({
                message: 'Post fetched',
                post: post
            });
        }).catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500
            }
            next(err);
        });

}

exports.UpdatePost = (req, res, next) => {
    const postId = req.params.postId;
    const error = validationResult(req);
    if (!error.isEmpty()) {
        const error = new Error('Validation failed, entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if (req.file) {
        imageUrl = req.file.path;
    }
    if (!imageUrl) {
        const error = new Error('No File Picked');
        error.statusCode = 422;
        throw error;
    }

    Post.findById(postId)
        .then(post => {
            if (!post) {
                const err = new Error('The post was not found');
                err.statusCode = 404;
                throw err;
            }

            if (post.creator.toString() !== req.userId) {
                const error = new Error('The user is not authorized to delete');
                error.statusCode = 403;
                throw error;
            }

            if (imageUrl !== post.imageUrl) {
                clearImage(post.imageUrl);
            }

            post.title = title;
            post.content = content;
            post.imageUrl = imageUrl;
            return post.save();
        }).then(result => {
            res.status(200).json({
                message: 'Post updated successfully',
                post: result
            });
        }).catch(err => {
            if (err) {
                err.statusCode = 500;
            }
            next(err);
        });
};


const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => console.log(err));
}

exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const err = new Error('No post was found');
                err.statusCode = 404;
                throw err;
            }
            
            
            if (post.creator.toString() !== req.userId) {
                const err = new Error('This user does not have access to delete the post');
                err.statusCode = 403;
                throw err;
            }
            clearImage(post.imageUrl);
            return Post.findByIdAndRemove(postId);
        }).then(() => {
            return User.findOne(mongoose.Types.ObjectId(req.userId));
        }).then(user => {
            user.posts.pull(postId);
            return user.save();
        }).then(result => {
            res.status(200).json({
                message: 'The post got deleted successfully',
                data: result
            });
        }).catch(err => {
            if (err) {
                err.statusCode = 500;
            }
            next(err);
    });

    Post.findByIdAndDelete(postId);
}