require('dotenv').config();
import express from 'express';
import Cache from './cacheMiddleware.js';
import AWS from 'aws-sdk';
import {v4 as uuid} from "uuid";
import "core-js/stable";
import "regenerator-runtime/runtime";
import jwt from 'express-jwt';
import jwksRsa from 'jwks-rsa';

const cors = require('cors');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

let documentClient = new AWS.DynamoDB.DocumentClient();
const dynamoTable = "l2w-quizlet-storage";
const app = express();
const port = process.env.PORT || 8080;
const cache = new Cache();

// Enable server-side sessions
app.use(express.urlencoded());
app.use(express.json());
app.use(cors());


const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH_DOMAIN}/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer.
    audience: process.env.AUTH_AUDIENCE,
    issuer: `https://${process.env.AUTH_DOMAIN}/`,
    algorithms: ['RS256']
});


app.listen(port, () => {
    console.log(`Server started: http://localhost:` + port);
});


app.get('/api', (request, response) => {
    response.send(JSON.stringify({"api": "v0"}))
});


app.post('/api/user/:email/quiz', checkJwt, (request, response) => {
    console.log("CREATE QUIZ");
    let quiz = request.body;
    let email = request.params.email;
    if (!!quiz && !!email) {
        let params = {
            TableName: dynamoTable,
            Item: {
                email: email,
                quiz_id: uuid(),
                name: quiz.name,
                time: quiz.time,
                questions: quiz.questions
            },
            ReturnValues: 'ALL_OLD',

        };
        documentClient.put(params, function (err, data) {
            if (err) {
                console.log(err);
            } else {
                cache.remove("getAllQuizzes");
                response.send(params.Item);
            }
        });
    }
});

app.put('/api/user/:email/quiz/:id', checkJwt, (request, response) => {
    console.log("UPDATE QUIZ");
    let quiz = request.body;
    let quizId = request.params.id;
    let email = request.params.email;
    if (!!quiz && !!quizId && !!email) {
        let params = {
            TableName: dynamoTable,
            Item: {
                email: email,
                quiz_id: quizId,
                name: quiz.name,
                time: quiz.time,
                questions: quiz.questions
            },
            ReturnValues: 'ALL_OLD',
        };
        documentClient.put(params, function (err, data) {
            if (err) {
                console.log(err);
            } else {
                cache.remove(quizId);
                cache.remove("getAllQuizzes");
                response.send(params.Item);
            }
        });
    }
});


app.get('/api/user/:email/quiz/:id', checkJwt, (request, response) => {
    console.log("GET QUIZ");
    let quizId = request.params.id;
    let email = request.params.email;
    cache.get(quizId, response, () => {
        if (!!quizId && !!email) {
            let params = {
                TableName: dynamoTable,
                Key: {
                    email: email,
                    quiz_id: quizId
                }
            };
            documentClient.get(params, function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    response.send(data);
                    cache.set(quizId, data);
                }
            });
        }
    });
});


app.get('/api/user/:email/quiz', checkJwt, (request, response) => {
    let email = request.params.email;
    console.log("GET QUIZZES");
    let cacheKey = "getAllQuizzes";
    cache.get(cacheKey, response, () => {
        if (!!email) {
            let params = {
                TableName: dynamoTable,
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': email,
                }
            };
            documentClient.query(params, function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    cache.set(cacheKey, data.Items);
                    response.send(data.Items);
                }
            });
        }
    });
});


app.delete('/api/user/:email/quiz/:id', checkJwt, (request, response) => {
    console.log("DELETE QUIZ");
    let quizId = request.params.id;
    let email = request.params.email;
    if (!!quizId && !!email) {
        let params = {
            TableName: dynamoTable,
            Key: {
                email: email,
                quiz_id: quizId,
            },
        };
        documentClient.delete(params, function (err, data) {
            if (err) {
                console.log(err);
            } else {
                response.send(data);
            }
        });
    }
});
