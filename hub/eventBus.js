require('dotenv').config();
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://rabbitmq"
const Q_NEW_SESSION = process.env.Q_NEW_SESSION || "new_session_queue"
const Q_NODE_REGISTRATION = process.env.Q_NODE_REGISTRATION || "node_registration_queue"
const Q_SESSION_ENDED = process.env.Q_SESSION_ENDED || "session_ended_queue"

const amqp = require("amqplib");


let connection;
let channel;

async function createChannels() {
  try {
    connection = await amqp.connect(RABBITMQ_URI);
    channel = await connection.createChannel();

    await channel.assertQueue(Q_NODE_REGISTRATION);
    console.log("Node registration queue created.");

    await channel.assertQueue(Q_NEW_SESSION);
    console.log("New session queue created.");

    await channel.assertQueue(Q_SESSION_ENDED);
    console.log("Session ended queue created.");

  } catch (error) {
    console.error("Error creating RabbitMQ channels:", error);
  }
}

module.exports = {
  createChannels
};
