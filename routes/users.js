const express = require('express');
const db = require('../config/db');
const userRouter = express.Router();

function generateUID() {
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Generates a 4-digit random number
    return `S4L${randomNumber}`;
}
// Login 
userRouter.post("/login", (req, res) => {
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

  // Logout 
  userRouter.post("/logout", (req, res) => {
    const { userId } = req.body;
    db.query(
      "INSERT INTO UserHistory (user_id, action) VALUES (?, 'Logged Out')",
      [userId]
    );
    res.json({ message: "Logout recorded" });
  });

  // Check user exists 

  userRouter.post("/check-user", (req, res) => {
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
  userRouter.post("/check-user-history", (req, res) => {
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
  
// Reset Password 
userRouter.post("/reset-password", async (req, res) => {
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

    // Get All Users
    userRouter.get("/users", (req, res) => {
        db.query("SELECT * FROM user", (err, results) => {
          if (err) return res.status(500).send(err);
          res.json(results);
        });
      });

      // Get User History
      userRouter.get("/users/:id/history", (req, res) => {
        db.query(
          "SELECT * FROM user_history WHERE user_id = ?",
          [req.params.id],
          (err, results) => {
            if (err) return res.status(500).send(err);
            res.json(results);
          }
        );
      });



// //Create User
// userRouter.post("/users", async (req, res) => {
//     const {
//       motel_name,
//       motel_id,
//       motel_location,
//       username,
//       password,
//       fullname,
//       email,
//       street,
//       city,
//       state,
//       zipcode,
//       country,
//       phone,
//       hiring_date,
//       role,
//       enabled,
//     } = req.body;

  
//     if (!username || !password || !fullname || !hiring_date) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }
  
//     try {
//       const uid = generateUID()
//       db.query(
//         `INSERT INTO user 
//           (motel_name, motel_id, motel_location,uid, username, password, fullname, email, street, city, state, zipcode, country, phone, hiring_date, role, enabled) 
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`,
//         [
//           motel_name,
//           motel_id,
//           motel_location,
//           uid,
//           username,
//           password,
//           fullname,
//           email,
//           street,
//           city,
//           state,
//           zipcode,
//           country,
//           phone,
//           hiring_date,
//           role,
//           enabled || 1,
//         ],
//         (err, result) => {
//           if (err) return res.status(500).send(err);
//           res.status(201).json({ message: "User created successfully" });
//         }
//       );
//     } catch (error) {
//       console.log(error)
//       res.status(500).json({ message: "Error creating user", error });
//     }
//   });
  

userRouter.post("/users", async (req, res) => {
  const { motel_id, username, password, fullname, role, ...optionalFields } = req.body;

  if (!motel_id || !username || !password || !fullname || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const uid = generateUID();
    const columns = ["motel_id", "username", "password", "fullname", "role", "uid"];
    const values = [motel_id, username, password, fullname, role, uid];
    
    Object.entries(optionalFields).forEach(([key, value]) => {
      if (value !== undefined) {
        columns.push(key);
        values.push(value);
      }
    });
    
    const placeholders = columns.map(() => "?").join(", ");
    const query = `INSERT INTO user (${columns.join(", ")}) VALUES (${placeholders})`;

    db.query(query, values, (err, result) => {
      if (err) return res.status(500).send(err);
      res.status(201).json({ message: "User created successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating user", error });
  }
});

  //  DELETE User by ID
  userRouter.delete("/users/:id", (req, res) => {
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

  //Update User details
  userRouter.put("/users/:id", (req, res) => {
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

// Enable/Disable User
userRouter.put("/user/:id/status", (req, res) => {
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

module.exports = userRouter;