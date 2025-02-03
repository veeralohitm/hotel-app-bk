const express = require('express');
require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require("bcrypt");


// Next initialize the application
const app = express();
const cors = require("cors");
app.use(cors());

app.use(express.json()); // Middleware to parse JSON requests

// Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Test the database connection
db.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
      return;
    }
    console.log('Connected to the MySQL database');
    connection.release();
  });
  

// routing path
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});

// POST: Create a new motel and generate rooms
app.post('/motels', async (req, res) => {
    const { Name, Location, Rooms } = req.body;
  
    // Validate the form data
    if (!Name || !Location || !Rooms || !Array.isArray(Rooms) || Rooms.length === 0) {
      return res.status(400).json({ error: 'Invalid input. Name, Location, and Rooms are required.' });
    }
  
    // Start a transaction
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
  
      // Step 1: Insert the motel
      const [motelResult] = await connection.query(
        'INSERT INTO Motel (Name, Location) VALUES (?, ?)',
        [Name, Location]
      );
      const MotelID = motelResult.insertId;
  
      // Step 2: Generate rooms based on the provided room data
      for (const room of Rooms) {
        const { RoomTypeID, NumberOfRooms, StartNumber, EndNumber } = room;
  
        if (!RoomTypeID || !NumberOfRooms || !StartNumber || !EndNumber || StartNumber > EndNumber) {
          throw new Error('Invalid room data provided.');
        }
  
        // Check if the number of rooms matches the range
        const rangeCount = EndNumber - StartNumber + 1;
        if (NumberOfRooms !== rangeCount) {
          throw new Error(
            `Mismatch between NumberOfRooms (${NumberOfRooms}) and the range (${rangeCount}) for room type ${RoomTypeID}.`
          );
        }
  
        // Insert rooms into the Room table
        for (let i = StartNumber; i <= EndNumber; i++) {
          await connection.query(
            'INSERT INTO Room (MotelID, RoomTypeID, RoomNumber, Status) VALUES (?, ?, ?, ?)',
            [MotelID, RoomTypeID, i, 'Available']
          );
        }
      }
  
      // Commit the transaction
      await connection.commit();
  
      res.json({ message: 'Motel and rooms created successfully', MotelID });
    } catch (err) {
      // Roll back in case of an error
      await connection.rollback();
      console.error('Error creating motel and rooms:', err.message);
      res.status(500).json({ error: 'Failed to create motel and rooms', details: err.message });
    } finally {
      connection.release();
    }
  });


   // 🔹 Get All Motel Names
   app.get("/motels", (req, res) => {
    db.query("SELECT motel_id,motel_name,motel_location FROM motel_details", (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });

  function generateUID() {
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Generates a 4-digit random number
    return `S4L${randomNumber}`;
}

  //Create User
app.post("/users", async (req, res) => {
    const {
      motel_name,
      motel_id,
      motel_location,
      username,
      password,
      fullname,
      email,
      street,
      city,
      state,
      zipcode,
      country,
      phone,
      hiring_date,
      role,
      enabled,
    } = req.body;

  
    if (!username || !password || !fullname || !hiring_date) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    try {
      const uid = generateUID()
      db.query(
        `INSERT INTO user 
          (motel_name, motel_id, motel_location,uid, username, password, fullname, email, street, city, state, zipcode, country, phone, hiring_date, role, enabled) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`,
        [
          motel_name,
          motel_id,
          motel_location,
          uid,
          username,
          password,
          fullname,
          email,
          street,
          city,
          state,
          zipcode,
          country,
          phone,
          hiring_date,
          role,
          enabled || 1,
        ],
        (err, result) => {
          if (err) return res.status(500).send(err);
          res.status(201).json({ message: "User created successfully" });
        }
      );
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: "Error creating user", error });
    }
  });
  
  // 🔹 Enable/Disable User
  app.put("/user/:id/status", (req, res) => {
    const { enabled } = req.body;
    db.query(
      "UPDATE user SET enabled = ? WHERE user_id = ?",
      [enabled, req.params.id],
      (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ message: "User status updated" });
      }
    );
  });
  
  app.put("/users/:id", (req, res) => {
    const userId = req.params.id;
    //console.log(userId)
    const { username, password, role } = req.body;
    const sql = "UPDATE user SET username = ?, password = ?, role = ? WHERE user_id = ?";
  
    db.query(sql, [username, password, role, userId], (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "User updated successfully!" });
    });
  });


  // 🔹 User Login
  app.post("/login", (req, res) => {
    const { username, password } = req.body;
  
    db.query(
      "SELECT * FROM user WHERE username = ?",
      [username],
      async (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0)
          return res.status(401).json({ message: "User not found" });
  
        const user = results[0];
        const isPasswordValid = user.password;
  
        if (!isPasswordValid)
          return res.status(401).json({ message: "Invalid credentials" });
  
        db.query(
          "INSERT INTO user_history (user_id, action) VALUES (?, 'Logged In')",
          [user.user_id]
        );
  
        res.json({ message: "Login successful", user });
      }
    );
  });
  
  // 🔹 User Logout
  app.post("/logout", (req, res) => {
    const { userId } = req.body;
    db.query(
      "INSERT INTO UserHistory (user_id, action) VALUES (?, 'Logged Out')",
      [userId]
    );
    res.json({ message: "Logout recorded" });
  });
  
  // 🔹 Get All Users
  app.get("/users", (req, res) => {
    db.query("SELECT * FROM user", (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
  
  // 🔹 Get User History
  app.get("/users/:id/history", (req, res) => {
    db.query(
      "SELECT * FROM UserHistory WHERE user_id = ?",
      [req.params.id],
      (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
      }
    );
  });

  // 📌 DELETE User by ID
app.delete("/users/:id", (req, res) => {
    const userId = req.params.id;
    const query = "DELETE FROM user WHERE user_id = ?";
  
    db.query(query, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Database error", details: err });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    });
  });