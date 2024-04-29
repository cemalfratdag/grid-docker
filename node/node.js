require('dotenv').config();
const express = require("express");
const amqp = require("amqplib");
const {exec} = require('child_process');
const axios = require('axios');

const NODE_PORT = process.env.NODE_PORT || 4000
const DISTRIBUTOR_PORT = process.env.DISTRIBUTOR_PORT || 4001
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://rabbitmq"
const Q_NODE_REGISTRATION = process.env.Q_NODE_REGISTRATION || "node_registration_queue"
const Q_SESSION_ENDED = process.env.Q_SESSION_ENDED || "session_ended_queue"

const app = express();
app.use(express.json());

let status = {
  availability: "up", // up, down
  //node is the docker service name, uri should be localhost when running on local machine
  uri: `http://node:${NODE_PORT}`,
  lastSessionCreated: null,
  id: "1",
  session: null
}

app.get("/", (req, res) => {
  res.send("Node 1");
});

app.get("/status", (req, res) => {
  res.send(status.availability);
});

app.post("/create-session", async (req, res) => {
  let {session} = req.body;
  let newSession = {
    ...session,
    startedAt: new Date().toISOString(),
    uri: status.uri
  }

  status.availability = "down"
  status.lastSessionCreated = newSession.startedAt
  status.session = newSession

  const script = `./${session.testName}.sh`;
  exec(script, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
    }
  });

  res.send("success");
})

app.post("/existing-session", (req, res) => {
  let {session} = req.body;
  console.log('Existing session:', session);
  res.send("success");
})

app.listen(NODE_PORT, () => {
  console.log(`Node listening at ${NODE_PORT}`);
});

async function publishHeartbeat(message) {
  try {
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.assertQueue(Q_NODE_REGISTRATION);

    await channel.sendToQueue(Q_NODE_REGISTRATION, Buffer.from(message));

  } catch (error) {
    console.error("Error publishing node registration heartbeat:", error);
  }
}


async function consumeSessionResults() {
  try {
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.assertQueue(Q_SESSION_ENDED);
    console.log("Session ended queue created.");

    await channel.consume(
      Q_SESSION_ENDED,
      (message) => {
        if (message) {
          let result = JSON.parse(message.content.toString());
          console.log("Test result received:", result)

          axios.post(`http://distributor:${DISTRIBUTOR_PORT}/test-completed`, {
            sessionId: status.session.id,
            duration: result.duration
          }).then((response) => {
            console.log("Test result sent to the distributor.");
          }).catch((error) => {
            console.error("Error sending test result to the distributor:", error);
          })

          status.availability = "up"
          status.session = null

          channel.ack(message);
        }
      }, {noAck: false});
  } catch (error) {
    console.error(
      "Error consuming messages from session ended queue:",
      error,
    );
  }

}

setInterval(() => {
  publishHeartbeat(JSON.stringify(status));
}, 1000);


  consumeSessionResults().then(() => {
    console.log("Session results consumer started.");
  })


