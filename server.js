require('dotenv').config();
require('request');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
import Cache from './cacheMiddleware.js';

const app = express();
const port = process.env.PORT || 8080;
const AWS = require('aws-sdk');
import {v4 as uuid} from "uuid";

const cors = require('cors');

AWS.config.update({
    region: process.env.region,
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey
});
let documentClient = new AWS.DynamoDB.DocumentClient();

const dynamoTable = "l2w-quiz-storage";

// Enable server-side sessions
app.use(cookieParser(process.env.sessionSecretKey));
app.use(express.urlencoded());
app.use(express.json());
app.use(cors());
app.use(session({
    secret: process.env.sessionSecretKey,
    proxy: true,
    resave: true,
    saveUninitialized: true
}));


const cache = new Cache();

app.listen(port, () => {
    console.log(`Server started: http://localhost:` + port);
});


app.get('/api', (request, response) => {
    response.send(JSON.stringify({"api": "v0"}))
});


/**
 * NOTE: All of the below is obviously not performant at scale and would need to be partitioned by user
 * but for the sake of this assignment, I'm keeping it simple
 */

app.post('/api/quiz/', (request, response) => {
    let quiz = request.body;
    if (!!quiz) {
        let params = {
            TableName: dynamoTable,
            Item: {
                Id: uuid(),
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
                console.log(data);
                response.send(params.Item);
            }
        });
    }
});


app.get('/api/quiz/:id', (request, response) => {
    let quizId = request.params.id;
    let requestKey = request.url;
    cache.get(requestKey, response, () => {
        if (!!quizId) {
            let params = {
                TableName: dynamoTable,
                Key: {
                    Id: quizId
                }
            };
            documentClient.get(params, function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(data);
                    response.send(data);
                    cache.set(requestKey, data);
                }
            });
        }
    });
});


app.get('/api/quiz', (request, response) => {
    scanTable(dynamoTable).then(results => {
        response.send(results)
    })
});


app.delete('/api/quiz/:id', (request, response) => {
    console.log("DELETE");
    let quizId = request.params.id;
    console.log(quizId);
    if (!!quizId) {
        let params = {
            TableName: dynamoTable,
            Key: {
                Id: quizId,
            },
        };
        documentClient.delete(params, function (err, data) {
            if (err) {
                console.log(err);
            } else {
                console.log(data);
                response.send(data);
            }
        });
    }
});


export const scanTable = async (tableName) => {
    const params = {
        TableName: tableName,
    };
    let scanResults = [];
    let items;
    do {
        items = await documentClient.scan(params).promise();
        items.Items.forEach((item) => scanResults.push(item));
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey != "undefined");
    return scanResults;
};