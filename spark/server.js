/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const express = require('express');
const request = require('request');
const app = express();
const dialogflowSessionClient =
    require('../botlib/dialogflow_session_client.js');

app.use(express.json());

//For authenticating dialogflow_session_client.js, create a Service Account and
// download its key file. Set the environmental variable
// GOOGLE_APPLICATION_CREDENTIALS to the key file's location.
//See https://dialogflow.com/docs/reference/v2-auth-setup and
// https://cloud.google.com/dialogflow/docs/setup for details.

//Upon start a webhook is registered with spark
//Upon closure the webhook is removed from spark

//Insert your values here
const sparkAccessToken ="ZjJmMzMyZmUtODY5OC00NzRhLTk3ZTYtOWNiZTI0YjVkNDE4MjcyOWRlZmQtMTNk_PF84_0d882151-70b4-4264-a09c-4a599e4494b1";
const targetUrl = 'traffic at https://gcf-gknuzu7cma-uc.a.run.app';
const projectId = 'cbucc-mafg';

const sessionClient = new dialogflowSessionClient(projectId);

const listener = app.listen(process.env.PORT, async function() {
  await init();
  console.log('Your Spark integration server is listening on port '
      + listener.address().port);
});

app.post('/', async function(req, res) {
  const message = await retrieveMessage(req.body.data.id);
  if (message) {
    const dialogflowResponse = (await sessionClient.detectIntent(
        message.text, message.email, message.payload)).fulfillmentText;
    sendMessage(dialogflowResponse, message.email);
  }
});

process.on('SIGTERM', () => {
  listener.close(async ()=>{
    console.log('Closing http server.');
    await deleteWebhooks();
    process.exit(0);
  });
});

async function init(){
  await deleteWebhooks();
  registerWebhook();
}

function sendMessage(text, personEmail) {
  request.post('https://api.ciscospark.com/v1/messages', {
    auth: {
      bearer: sparkAccessToken
    },
    json: {
      "toPersonEmail": personEmail,
      "text": text
    }
  }, (err, resp, body) => {
    if (err) {
      console.error('Failed to send message :' + err);
    }
  });
}

function registerWebhook() {
  request.post('https://api.ciscospark.com/v1/webhooks', {
    auth: {
      bearer: sparkAccessToken
    },
    json: {
      "name": "test",
      "targetUrl": targetUrl,
      "resource": "messages",
      "event": "created"
    }
  }, (err, resp, body) => {
    if (err) {
      console.error('Failed to create Webhook :' + err);
    }
  });
}

function deleteWebhooks() {
  return new Promise((resolve, reject) =>{
    request.get('https://api.ciscospark.com/v1/webhooks?max=100', {
      auth: {
        bearer: sparkAccessToken
      }
    }, (err, resp, body) => {
      if (err) {
        console.error('Failed to check webhooks :' + err);
        reject();
      }
      var webhooks = JSON.parse(resp.body).items;
      if (Array.isArray(webhooks)) {
        webhooks = webhooks.filter((value, index, arr)=> {
          return value.targetUrl===targetUrl;
        });
        webhooks.forEach((webhook) => {
          request.delete(
              'https://api.ciscospark.com/v1/webhooks/' +
              webhook.id, {
                auth: {
                  bearer: sparkAccessToken
                }
              }, (err, resp, body) => {
                if (err) {
                  console.error('Failed to delete webhook :' + err);
                }
              });
        });
      }
      resolve();
    });
  });
}

function retrieveMessage(messageId) {
  return new Promise((resolve, reject) =>{
    request.get('https://api.ciscospark.com/v1/messages/' + messageId, {
      auth: {
        bearer: sparkAccessToken
      }
    }, (err, resp, body) => {
      if (err) {
        console.error('Failed to retrieve message :' + err);
        reject();
      }
      //checks to make sure the message is not from itself
      if (!((JSON.parse(resp.body).personEmail).includes('webex.bot'))) {
        const personEmail = JSON.parse(resp.body).personEmail;
        const messageText= JSON.parse(resp.body).text;
        const payload = JSON.parse(resp.body);
        resolve({text: messageText, email: personEmail, payload:payload});
      } else {
        resolve(null);
      }
    });
  });
}
