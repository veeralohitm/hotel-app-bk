const express = require('express');
require('dotenv').config();
const mysql = require('mysql2');


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
    const { Name, Location, roomSets, max_rooms } = req.body;
    //console.log(Name, Location, roomSets, max_rooms);
  
    // Validate the form data
    if (!Name || !Location || !roomSets || !Array.isArray(roomSets) || roomSets.length === 0) {
      return res.status(400).json({ error: 'Invalid input. Name, Location, and Rooms are required.' });
    }
  
   // if (max_rooms && max_rooms > 30) {
    //  return res.status(400).json({ error: 'You cannot create more than 30 rooms' });
   // }
  
    // Calculate total number of rooms from all roomSets
    //const totalRooms = roomSets.reduce((total, roomSet) => total + parseInt(roomSet.numRooms), 0);
  
    //if (totalRooms > (max_rooms || 30)) {
    //  return res.status(400).json({ error: 'You cannot create more than 30 rooms' });
    //}
  
    // Start a transaction
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
  
      // Step 1: Insert the motel into the motel_details table
      const [motelResult] = await connection.query(
        'INSERT INTO motel_details (motel_name, motel_location,motel_max_rooms) VALUES (?, ?,?)',
        [Name, Location,max_rooms]
      );
      const MotelID = motelResult.insertId;
  
      // Step 2: Process each room set and insert rooms into the room table
      for (const room of roomSets) {
        const { roomType, numRooms, startNumber } = room;
  
        if (!roomType || !numRooms || !startNumber) {
          throw new Error('Invalid room data provided.');
        }
  
        // Get the room_type_id from the room_type table based on the roomType
        const [roomTypeResult] = await connection.query(
          'SELECT roomtype_id FROM room_type WHERE roomtypename = ?',
          [roomType]
        );
  
        if (roomTypeResult.length === 0) {
          throw new Error(`Room type "${roomType}" not found.`);
        }
  
        const roomTypeID = roomTypeResult[0].roomtype_id;
  
        // Determine the number of rooms based on the number of rooms provided and the range of numbers
        const startRoomNumber = parseInt(startNumber); // Assuming startNumber is like "101"
        const roomSuffix = startNumber.slice(-2); // Get "-A" or "-B" suffix
  
        // Insert rooms in a loop
        for (let i = 0; i < numRooms; i++) {
          const roomNumber = `${startRoomNumber + i}${roomSuffix}`;
  
          await connection.query(
            'INSERT INTO room (motel_id, roomtype_id, roomnumber) VALUES (?, ?, ?)',
            [MotelID, roomTypeID, roomNumber]
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
  
  app.delete("/motels/:id", async (req, res) => {
    const { id } = req.params;
  
    if (!id) {
      return res.status(400).json({ error: "Motel ID is required." });
    }
  
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
  
      // Check if the motel exists
      const [motel] = await connection.query("SELECT * FROM motel_details WHERE motel_id = ?", [id]);
      if (motel.length === 0) {
        throw new Error("Motel not found.");
      }
  
      // Delete associated rooms
      await connection.query("DELETE FROM room WHERE motel_id = ?", [id]);
  
      // Delete the motel
      await connection.query("DELETE FROM motel_details WHERE motel_id = ?", [id]);
  
      await connection.commit();
      res.json({ message: "Motel and associated rooms deleted successfully." });
  
    } catch (error) {
      await connection.rollback();
      console.error("Error deleting motel:", error.message);
      res.status(500).json({ error: "Failed to delete motel.", details: error.message });
    } finally {
      connection.release();
    }
  });

   // 🔹 Get All Motel Names
//    app.get("/motels", (req, res) => {
//     db.query("SELECT motel_id,motel_name,motel_location FROM motel_details", (err, results) => {
//       if (err) return res.status(500).send(err);
//       res.json(results);
//     });
//   });
app.get("/avl_rooms", async (req, res) => {
    try {
        const { motel_id, roomtypename } = req.query;
        const connection = await db.promise().getConnection();
        //console.log(motel_id, roomtypename)

        if (!motel_id) {
            return res.status(400).json({ error: "motel_id is required" });
        }

        // Fetch motel details
        const motelQuery = "SELECT * FROM motel_details WHERE motel_name = ?";
        const [motel] = await connection.query(motelQuery, [motel_id]);

        if (!motel) {
            return res.status(404).json({ error: "Motel not found" });
        }
       // console.log(motel)

        // Fetch roomtype_id using roomtypename
        let roomTypeCondition = "";
        let roomtypeid = "";

        if (roomtypename && roomtypename !== "All") {
            const roomTypeQuery = "SELECT roomtype_id FROM room_type WHERE roomtypename = ?";
            const [roomType] = await connection.query(roomTypeQuery, [roomtypename]);
            console.log(roomType[0].roomtype_id)

            if (!roomType) {
                return res.status(404).json({ error: "Room type not found" });
            }

            //roomTypeCondition = "AND roomtype_id = ?";
            roomtypeid = roomType[0].roomtype_id
            //roomTypeParams.push(roomType[0].roomtype_id);
        }
        //console.log(roomTypeParams)
        // Fetch available rooms for the motel, filtering by roomtypename if provided
        const current_booking_status = "available"
        const roomsQuery = `
            SELECT r.*, rt.roomtypename 
            FROM room r  
            INNER JOIN room_type rt ON r.roomtype_id = rt.roomtype_id  
            WHERE r.motel_id = ? AND r.roomtype_id = ? AND r.current_booking_status = ?;
        `;
        //console.log(motel[0].motel_id)
        const [rooms] = await connection.query(roomsQuery, [motel[0].motel_id, roomtypeid,current_booking_status]);
        //console.log(rooms)
        res.json({
            motel,
            available_rooms: rooms,
        });
        //console.log(res) 
    } catch (error) {
        console.error("Error fetching motel details and rooms:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.get("/rooms", (req, res) => {
    const { motel_id } = req.query;
  
    if (!motel_id) {
      return res.status(400).json({ error: "Motel ID is required" });
    }
  
    const query = `
      SELECT r.room_id, r.motel_id, rt.roomtypename , r.roomnumber
      FROM room r
      JOIN room_type rt ON r.roomtype_id = rt.roomtype_id
      WHERE r.motel_id = ?
    `;
  
    db.query(query, [motel_id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database query failed" });
      }
      res.json(results);
    });
  });

  app.get("/motels", (req, res) => {
    // Query to get motels along with room details grouped by room type
    const query = `
      SELECT 
        m.motel_id, 
        m.motel_name, 
        m.motel_location, 
        m.motel_max_rooms, 
        rt.roomtypename, 
        COUNT(r.room_id) AS room_count, 
        MIN(r.roomnumber) AS start_room_number
      FROM motel_details m
      LEFT JOIN room r ON m.motel_id = r.motel_id
      LEFT JOIN room_type rt ON r.roomtype_id = rt.roomtype_id
      GROUP BY m.motel_id, rt.roomtypename
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).send(err);

        // Group the results by motel_id
        const motels = results.reduce((acc, row) => {
            const motel = acc.find(motel => motel.motel_id === row.motel_id);
            if (motel) {
                motel.room_types.push({
                    roomtypename: row.roomtypename,
                    room_count: row.room_count,
                    start_room_number: row.start_room_number
                });
            } else {
                acc.push({
                    motel_id: row.motel_id,
                    motel_name: row.motel_name,
                    motel_location: row.motel_location,
                    motel_max_rooms: row.motel_max_rooms,
                    room_types: [{
                        roomtypename: row.roomtypename,
                        room_count: row.room_count,
                        start_room_number: row.start_room_number
                    }]
                });
            }
            return acc;
        }, []);

        res.json(motels);
    });
});


//Edit Motel 
app.put("/motels/:id", async (req, res) => {
    const { id } = req.params;
    const { roomSets } = req.body;
  
    //console.log(id,roomSets)
    if (!roomSets || !Array.isArray(roomSets)) {
      return res.status(400).json({ error: "Invalid room data." });
    }
  
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
  
      // Get existing motel details
      const [motel] = await connection.query("SELECT * FROM motel_details WHERE motel_id = ?", [id]);
      if (motel.length === 0) {
        throw new Error("Motel not found.");
      }
      const maxRooms = motel[0].motel_max_rooms;
      //console.log(maxRooms)

      const totalRooms = roomSets.reduce((sum, room) => sum + parseInt(room.room_count || 0), 0);
      if (totalRooms > maxRooms) {
        throw new Error(`Total rooms cannot exceed ${maxRooms}.`);
      }
  
      // Delete existing rooms for the motel
      await connection.query("DELETE FROM room WHERE motel_id = ?", [id]);
  
      // Insert updated rooms
      for (const room of roomSets) {
        const [roomType] = await connection.query("SELECT roomtype_id FROM room_type WHERE roomtypename = ?", [room.roomtypename]);
        //console.log(roomType)
        if (roomType.length === 0) {
          throw new Error(`Invalid room type: ${room.roomType}`);
        }
  
        const startNumber = parseInt(room.start_room_number.split("-")[0]); // Extract number part from "101-A"
        for (let i = 0; i < room.room_count; i++) {
          const roomNumber = `${startNumber + i}-${room.start_room_number.split("-")[1]}`; // Maintain -A or -B
          await connection.query(
            "INSERT INTO room (motel_id, roomtype_id, roomnumber) VALUES (?, ?, ?)",
            [id, roomType[0].roomtype_id, roomNumber]
          );
        }
      }
  
      await connection.commit();
      res.json({ message: "Motel rooms updated successfully." });
  
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ error: error.message });
    } finally {
      connection.release();
    }
  });  

///Get Room Types 
  app.get("/roomtypes", (req, res) => {
    db.query("SELECT roomtypename FROM room_type", (err, results) => {
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
  
  // Get All Users
  app.get("/users", (req, res) => {
    db.query("SELECT * FROM user", (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
  
  // Get User History
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

  app.post("/check-user", (req, res) => {
    const { username } = req.body;
  
    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }
  
    const query = "SELECT COUNT(*) AS count FROM user WHERE username = ?";
    db.query(query, [username], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
      }
  
      const userExists = results[0].count > 0;
      res.json({ success: true, exists: userExists });
    });
  });

  //Check user_history 
  app.post("/check-user-history", (req, res) => {
    const { username } = req.body;
  
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
  
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM user_history WHERE user_id = (SELECT user_id FROM user WHERE username = ?)
      ) AS userExists;
    `;
  
    db.query(query, [username], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
  
      const isFirstLogin = results[0].userExists === 0;
      return res.json({ isFirstLogin });
    });
  });
  
// Reset Password Route
app.post("/reset-password", async (req, res) => {
    const { username, newPassword } = req.body;
  
    // Validate input
    if (!username || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Invalid input" });
    }
  
    // Check if the user exists in the database
    db.execute("SELECT * FROM user WHERE username = ?", [username], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "An error occurred while accessing the database." });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: "User not found." });
      }
      //console.log(results[0].user_id)
      // Hash the new password
      try {
        const hashedPassword = newPassword;
  
        // Update password in the database
        db.execute("UPDATE user SET password = ? WHERE username = ?", [hashedPassword, username], (updateErr, updateResults) => {
          if (updateErr) {
            console.error("Update error:", updateErr);
            return res.status(500).json({ message: "An error occurred while updating the password." });
          }
          db.query(
            "INSERT INTO user_history (user_id, action) VALUES (?, 'Password Updated')",
            [results[0].user_id]
          );
          return res.status(200).json({ message: "Password updated successfully." });
        });
      } catch (error) {
        console.error("Hashing error:", error);
        return res.status(500).json({ message: "An error occurred while hashing the password." });
      }
    });
  });
  
  //book a room
  app.post('/bookaroom', async (req, res) => {
    try {
        const { motel_name, customer_details, room_type, check_in, nights, rooms, adults, check_out } = req.body;
        
        // Get motel_id
        const [motelRows] = await db.execute('SELECT motel_id FROM motel_details WHERE motel_name = ?', [motel_name]);
        if (motelRows.length === 0) return res.status(400).json({ error: 'Motel not found' });
        const motel_id = motelRows[0].motel_id;
        
        // Extract only the available fields from customer_details
        const fields = Object.keys(customer_details);
        const values = Object.values(customer_details);
        // Handle image file if it's included
        if (customer_details.customer_image) {
            fields.push('customer_image');
            values.push(customer_details.customer_image); // This is a Buffer (BLOB)
        }
        //SQL query dynamically
        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT INTO customer (${fields.join(', ')}) VALUES (${placeholders})`;
        const [customerResult] = await db.execute(sql, values);
        // Insert customer and get customer_id
        //const [customerResult] = await db.execute(
        //    'INSERT INTO customer (firstname, lastname, street, city, state, zipcode, email,phone,customer_image) VALUES (?, ?, ?)',
         //   [customer_details.name, customer_details.email, customer_details.phone]
        //);
        const customer_id = customerResult.insertId;
        
        //Get room_type_id 
       const [roomtypeRows] =  await db.execute(
        'SELECT roomtype_id FROM room_type WHERE roomtypename= ?',
        [room_type]
    );
    const roomtype_id = roomtypeRows[0].roomtype_id;

        // Get room_id
        const [roomRows] = await db.execute(
            'SELECT room_id FROM rooms WHERE motel_id = ? AND room_type_id = ?',
            [motel_id, room_type]
        );
        if (roomRows.length === 0) return res.status(400).json({ error: 'Room not available' });
        const room_id = roomRows[0].room_id;
        
        // Calculate check_out date
        //const check_out = new Date(check_in);
        //check_out.setDate(check_out.getDate() + nights);
        //const booking_status = "booked"
        
        // Insert booking
        const [bookingResult] = await db.execute(
            'INSERT INTO book_a_room (motel_id, customer_id, room_id, check_in, nights, check_out, rooms, adults) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [motel_id, customer_id, room_id, check_in, nights, check_out, rooms, adults]
        );
        
        await db.query('UPDATE rooms SET current_booking_status = ? WHERE room_id = ?', ['booked', room_id]);

        res.status(201).json({ booking_id: bookingResult.insertId, message: 'Booking successful' });


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        await db.end();
    }
});