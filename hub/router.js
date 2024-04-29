require('dotenv').config();
const express = require("express");
const axios = require("axios");
const amqp = require("amqplib");
const {checkSessionExists} = require("./db.js");

const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://rabbitmq"
const Q_NEW_SESSION = process.env.Q_NEW_SESSION || "new_session_queue"
const ROUTER_PORT = process.env.ROUTER_PORT || 4002

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Router");
})

app.post("/new-session", async (req, res) => {
  const session = req.body;
  console.log("New session request received:", session)
  // Check if the request belongs to an existing session
  let result
  if (session.id !== undefined) {
    result = await checkSessionExists(session.id);
  }

  if (result) {
    axios.post(`${result}/existing-session`, {session})
      .then((response) => {
        res.send(response.data);
      })
      .catch((error) => {
        res.status(500).send("Error sending request to existing session.");
      })
  } else {
    publishMessage(JSON.stringify(session));
    res.send("New session request sent to the queue.");
  }
})

app.listen(ROUTER_PORT, () => {
  console.log(`Router is listening at ${ROUTER_PORT}`);
})

async function publishMessage(message) {
  try {
    console.log('Publishing new session request to the queue:', message)
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.sendToQueue(Q_NEW_SESSION, Buffer.from(message));

    console.log("New session request sent to the queue: ", message);
  } catch (error) {
    console.error("Error publishing new session request to the queue:", error);
  }
}

