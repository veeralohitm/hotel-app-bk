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


  
// userRouter.post("/createuser", async (req, res) => {
//   const { motel_id, username, password, fullname, role, hiring_date, ...optionalFields } = req.body;

//   if (!motel_id || !username || !password || !fullname || !role || !hiring_date) {
//     return res.status(400).json({ message: "Missing required fields" });
//   }

//   try {
//     const uid = generateUID();
//     const columns = ["motel_id", "username", "password", "fullname", "role", "hiring_date", "uid", "enabled"];
//     const values = [motel_id, username, password, fullname, role, hiring_date, uid, 1];
    
//     Object.entries(optionalFields).forEach(([key, value]) => {
//       if (value !== undefined) {
//         columns.push(key);
//         values.push(value);
//       }
//     });
    
//     const placeholders = columns.map(() => "?").join(", ");
//     const query = `INSERT INTO user (${columns.join(", ")}) VALUES (${placeholders})`;

//     db.query(query, values, (err, result) => {
//       if (err) return res.status(500).send(err);
//       res.status(201).json({ message: "User created successfully" });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error creating user", error });
//   }
// });


//Create User 

userRouter.post("/createuser", async (req, res) => {
  const { username, password, fullname, role, hiring_date, property_id, ...optionalFields } = req.body;

  if ( !username || !password || !fullname || !role || !hiring_date || !property_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {

    const checkUserQuery = "SELECT user_id FROM user WHERE username = ?";
    db.query(checkUserQuery, [username], (checkErr, checkResult) => {
      if (checkErr) return res.status(500).json({ message: "Error checking existing user", error: checkErr });
      
      if (checkResult.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }
    // Fetch role_id from User_Roles table
    const roleQuery = "SELECT role_id FROM User_Roles WHERE role_name = ?";
    db.query(roleQuery, [role], (roleErr, roleResult) => {
      if (roleErr) return res.status(500).json({ message: "Error fetching role ID", error: roleErr });
      
      if (roleResult.length === 0) {
        return res.status(400).json({ message: "Invalid role specified" });
      }

      const role_id = roleResult[0].role_id;
      const uid = generateUID();
      const columns = ["username", "password", "fullname", "role_id", "hiring_date", "uid", "enabled"];
      const values = [username, password, fullname, role_id, hiring_date, uid, 1];
      
      Object.entries(optionalFields).forEach(([key, value]) => {
        if (value !== undefined) {
          columns.push(key);
          values.push(value);
        }
      });
      
      const placeholders = columns.map(() => "?").join(", ");
      const query = `INSERT INTO user (${columns.join(", ")}) VALUES (${placeholders})`;

      db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ message: "Error inserting user", error: err });
        
        const user_id = result.insertId;
        const userPropertyQuery = "INSERT INTO User_Property_Relations (user_id, role_id, property_id) VALUES (?, ?, ?)";
        db.query(userPropertyQuery, [user_id, role_id, property_id], (relErr) => {
          if (relErr) return res.status(500).json({ message: "Error updating User_Property_Relations", error: relErr });
          res.status(201).json({ message: "User created successfully and relation updated" });
        });
      });
    });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating user", error });
  }
});


// Disable user 
userRouter.put("/users/disable/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const query = "UPDATE user SET enabled = 0 WHERE user_id = ?";
    db.query(query, [id], (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({ message: "User disabled successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error disabling user", error });
  }
});

//Update user
userRouter.put("/users/update/:id", async (req, res) => {
  const { id } = req.params;
  const { ...updateFields } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }
  
  const updates = Object.entries(updateFields)
    .filter(([_, value]) => value !== undefined)
    .map(([key, _]) => `${key} = ?`).join(", ");
  
  if (!updates) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  try {
    const query = `UPDATE user SET ${updates} WHERE user_id = ?`;
    const values = [...Object.values(updateFields).filter(value => value !== undefined), id];

    db.query(query, values, (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({ message: "User updated successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating user", error });
  }
});

// Enable user 
userRouter.put("/users/enable/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const query = "UPDATE user SET enabled = 1 WHERE user_id = ?";
    db.query(query, [id], (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({ message: "User enabled successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error enabling user", error });
  }
});

module.exports = userRouter;