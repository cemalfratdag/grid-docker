require('dotenv').config();

const { test, expect } = require("@playwright/test");
const { log } = require("console");
const amqp = require("amqplib");
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://rabbitmq"
const Q_SESSION_ENDED = process.env.Q_SESSION_ENDED || "session_ended_queue"
const TEST_MAIL = process.env.TEST_MAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
let testResult;

async function publishSessionResults(message) {
  try {
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();

    await channel.assertQueue(Q_SESSION_ENDED);
    console.log("Session ended queue created.");

    await channel.sendToQueue(Q_SESSION_ENDED, Buffer.from(message));

    console.log("Session results sent to the queue:", JSON.parse(message));
  } catch (error) {
    console.error("Error publishing session results:", error);
  }
}
let title = "Jotform Login Test";
test(title, async ({ page, browser }) => {
  const startTime = new Date(); // Start timing
  await page.goto("https://www.jotform.com/login/");

  let result;
  try {
    await page.fill('input[name="email"]', TEST_MAIL);
    await page.fill('input[name="pass"]', TEST_PASSWORD);
    await page.click("#signinButton");
    await expect(page).toHaveTitle("My Forms | Jotform");
    result = "Test passed";
  } catch (error) {
    result = `Test failed: ${error.message}`;
  }

  const endTime = new Date(); // End timing
  const duration = (endTime - startTime) / 1000; // Duration in seconds

  testResult = {
    test: title,
    result: result,
    duration: `${duration.toFixed(2)} secs`,
    timestamp: endTime.toISOString(),
  };

  //publish message to a rabbitmq queue
  await publishSessionResults(JSON.stringify(testResult));
});
