// const feedRoutes = require('./routes/feed');
// const authRoutes = require('./routes/auth');
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const graphqlHttp = require('express-graphql');
// const cors = require('cors');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

const app = express();

const fileStorage = multer.diskStorage({
    destination: (req, res, callBack) => {
        callBack(null, 'images');
    },
    filename: (req, file, callBack) => {
        callBack(null, Date.now() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, callBack) => {
    if ((file.mimetype === 'image/jpg') ||
        (file.mimetype === 'image/jpeg') ||
        (file.mimetype === 'image/png')) {
            callBack(null, true);
    } else {
        callBack(null, false);
    }    
}

app.use(bodyParser.json());
app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

// app.use(cors({
//     origin: true,
//     credentials: true
// }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// app.use('/feed', feedRoutes);
// app.use('/auth', authRoutes);
app.use(auth);
app.put('/post-image', (req, res, next) => {
    if (!req.isAuth) {
        const err = new Error('The user is not authenticated');
        err.statusCode = 401;
        throw err;
    }
    if (!req.file) {
        res.status(200).json({message: 'No message was found'});
    }

    if (req.body.oldPath) {
        clearImage(req.body.oldPath);
    }

    return res.status(201).json({message: 'File Stored.', filePath: req.file.path});
});



app.use('/graphql', graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {        
        if (!err.originalError) {
            return err;
        }
        const data = err.originalError.errorMessages;
        const message = err.message;
        const code = err.originalError.statusCode;        
        return {
            message: message,
            code: code,
            data: data
        };
    }
}));

app.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({message: message, data: data});
});

mongoose.connect('mongodb+srv://amit:amit@amittestcluster-ynjnp.mongodb.net/test?retryWrites=true', { useNewUrlParser: true })
    .then(() => {
        app.listen(8080);
        // const server = app.listen(8080);
        // const io = require('./socket').init(server);
        // io.on('connection', socket => {
        //     console.log('Client Connected');
        // });
    }).catch(err => console.log(err));

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => console.log(err));
}
    