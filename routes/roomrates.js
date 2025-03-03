const express = require('express');
const db = require('../config/db');
const roomratesRouter = express.Router();

///Get all Room Rates 
roomratesRouter.get("/roomrates", (req, res) => {
    db.query("SELECT * FROM room_rates", (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
// Get room rate for specific roomtype name
roomratesRouter.post('/get-room-rate', (req, res) => {
    const { roomtypename } = req.body;

    const query = 'SELECT rr.* FROM room_rates rr JOIN room_type rt ON rr.roomtype_id = rt.roomtype_id WHERE rt.roomtypename = ?';
    db.query(query, [roomtypename], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Room rate not found for the given room type' });
        }
        res.status(200).json(results);
    });
});
// Insert/Add Room rates 
roomratesRouter.post('/add-room-rate', (req, res) => {
    const { roomtypename, weekday_rate, weekend_rate, weekly_rate } = req.body;

    if (!roomtypename || !weekday_rate || !weekend_rate || !weekly_rate) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Get roomtype_id from roomtypes table
    const query = 'SELECT roomtype_id FROM room_type WHERE roomtypename = ?';
    db.query(query, [roomtypename], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Room type not found' });
        }

        const roomtype_id = results[0].id;
        
        // Insert into room_rates table
        const insertQuery = 'INSERT INTO room_rates (roomtype_id, weekday_rate, weekend_rate, weekly_rate) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [roomtype_id, weekday_rate, weekend_rate, weekly_rate], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err });
            }
            res.status(201).json({ message: 'Room rate added successfully', room_rate_id: result.insertId });
        });
    });
});

//Edit room rates 
roomratesRouter.put('/edit-room-rate/:id', (req, res) => {
    const { id } = req.params;
    const { weekday_rate, weekend_rate, weekly_rate } = req.body;

    if (!weekday_rate || !weekend_rate || !weekly_rate) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const updateQuery = 'UPDATE room_rates SET weekday_rate = ?, weekend_rate = ?, weekly_rate = ? WHERE id = ?';
    db.query(updateQuery, [weekday_rate, weekend_rate, weekly_rate, id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Room rate not found' });
        }
        res.status(200).json({ message: 'Room rate updated successfully' });
    });
});

  module.exports = roomratesRouter;