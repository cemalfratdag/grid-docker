require('dotenv').config();
const HOST = process.env.MYSQL_HOST
const PORT = process.env.MYSQL_PORT
const USER = process.env.MYSQL_USER
const PASSWORD = process.env.MYSQL_PASSWORD
const DATABASE = process.env.MYSQL_DATABASE

const mysql = require("mysql2/promise");
let db = false

const getDB = async () => {
  if (db !== false) {
    return db
  }
  db = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE
  });

  return db
}

async function createSessionMap() {
  const db = await getDB();

  const result = await db.query(`
    CREATE TABLE IF NOT EXISTS session_map (
      session_id VARCHAR(255) PRIMARY KEY,
      node_address VARCHAR(255),
      test_name VARCHAR(255),
      elapsed_time VARCHAR(255),
      status VARCHAR(100),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  if (result) {
    console.log("Session Map created.");
  } else {
    console.error("Error creating Session Map.");
  }
}

async function insertSession(sessionId, nodeAddress, testName) {
  const db = await getDB();

  const result = await db.query(`
    INSERT INTO session_map (session_id, node_address, test_name, elapsed_time, status, started_at)
    VALUES (?, ?, ?, 0, 'running', NOW())   
  `, [sessionId, nodeAddress, testName]);

  if (result) {
    console.log("New session added successfully with default values.");
  } else {
    console.error("Error adding new session.");
  }
}

async function updateSession(sessionId, elapsedTime) {
  const db = await getDB();

  const result = await db.query(`
    UPDATE session_map 
    SET elapsed_time = ?, status = 'done'
    WHERE session_id = ?
  `, [elapsedTime, sessionId]);

  if (result) {
    console.log("Session updated successfully.");
  } else {
    console.error("Error updating session.");
  }
}

async function checkSessionExists(sessionId) {
  const db = await getDB();

  const result = await db.query(`
    SELECT * FROM session_map WHERE session_id = ?
  `, [sessionId]);

  if (result && result.length > 0) {
    console.log("Session found:", result[0]);
    return result[0]; // Return the session object
  } else {
    console.log("No session found with ID:", sessionId);
    return null;
  }
}

createSessionMap()

module.exports = {
  getDB,
  insertSession,
  updateSession,
  checkSessionExists
}


