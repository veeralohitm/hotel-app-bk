const express = require('express');
const db = require('../config/db');
const roomtypesRouter = express.Router();

///Get All Room Types 
roomtypesRouter.get("/roomtypes", (req, res) => {
    db.query("SELECT roomtypename FROM room_type", (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });

// Add Room Type
roomtypesRouter.post('/add-room-type', (req, res) => {
    const { roomtypename } = req.body;

    if (!roomtypename) {
        return res.status(400).json({ message: 'Room type name is required' });
    }

    const insertQuery = 'INSERT INTO room_type (roomtypename) VALUES (?)';
    db.query(insertQuery, [roomtypename], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(201).json({ message: 'Room type added successfully', roomtype_id: result.insertId });
    });
});

module.exports = roomtypesRouter;

