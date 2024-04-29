require('dotenv').config();
const express = require("express");
const axios = require("axios");
const {v4: uuidv4} = require("uuid");
const amqp = require("amqplib");
const eventBus = require("./eventBus");
const {insertSession, updateSession} = require("./db.js");

const DISTRIBUTOR_PORT = process.env.DISTRIBUTOR_PORT || 4001
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://rabbitmq"
const Q_NEW_SESSION = process.env.Q_NEW_SESSION || "new_session_queue"
const Q_NODE_REGISTRATION = process.env.Q_NODE_REGISTRATION || "node_registration_queue"

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Distributor");
});

app.get("/nodes", (req, res) => {
  let availableNodes = nodes.filter(node => node.availability === "up")
  let result = {
    availableNodeCount: availableNodes.length,
    availableNodes,
    totalNodeCount: nodes.length,
    allNodes: nodes
  }
  res.send(result);
})

app.post("/test-completed", async (req, res) => {
const {sessionId, duration} = req.body;

await updateSession(sessionId, duration);

res.send("success")

})

app.listen(DISTRIBUTOR_PORT, () => {
  console.log(`Distributor listening at ${DISTRIBUTOR_PORT}`);
});

let nodes = []

async function receiveHeartbeat() {
  try {
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.consume(
      Q_NODE_REGISTRATION,
      (message) => {
        if (message) {
          console.log(
            "Received node registration message:",
            JSON.parse(message.content.toString()),
          );

          let newNode = JSON.parse(message.content.toString());
          axios.get(`${newNode.uri}/status`).then((response) => {
            let nodeIndex = nodes.findIndex(node => node.id === newNode.id);
            // If the node exists in the nodes array
            if (nodeIndex !== -1) {
              // If the new node information is different from the existing one
              // Update the existing node information
              if (JSON.stringify(nodes[nodeIndex]) !== JSON.stringify(newNode)) {
                nodes[nodeIndex] = newNode;
              }
            } else {
              // If the node does not exist in the nodes array, add it
              nodes.push(newNode);
              console.log("Node added to the nodes array:", nodes);
            }
            channel.ack(message);
          });
        }
      }, {noAck: false});
  } catch (error) {
    console.error(
      "Error consuming messages from node registration queue:",
      error,
    );
    throw error;
  }
}

async function receiveNewSessionRequest() {
  try {
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.consume(
      Q_NEW_SESSION,
      (sessionMessage) => {
        if (sessionMessage) {
          let session = JSON.parse(sessionMessage.content.toString());
          console.log("Received node registration sessionMessage:", session);

          // Find an available node
          let node = null;

          let availableNodes = nodes.filter(node => node.availability === "up")
          if (availableNodes.length > 0) {
            node = availableNodes[0];
            availableNodes[0].availability = "down";
          }

          if (node) {
            //create uuid for session
            session.id = uuidv4();

            //send new session request to node
            axios.post(`${node.uri}/create-session`, {session})
              .then((response) => {
                console.log("Response from node:", response.data);
                if (response.data === "success") {
                  //store the session data on session map
                  insertSession(session.id, node.uri, session.testName);

                  channel.ack(sessionMessage);
                } else {
                  console.log("Error creating session.");
                  channel.reject(sessionMessage, false);
                }
              })
              .catch((error) => {
                console.error("Error sending new session request to node:", error);
              });
          } else {
            channel.reject(sessionMessage, false);
          }

        }
      }, {noAck: false});

  } catch (error) {
    console.error(
      "Error consuming sessionMessages from new session queue:",
      error,
    );
    throw error;
  }
}

eventBus.createChannels().then(() => {
  receiveHeartbeat().then(() => {
    console.log("Listening node registration queue.");
  }).then(() => {
    receiveNewSessionRequest().then(() => {
      console.log("Listening new session queue.");
    });
  });
});
