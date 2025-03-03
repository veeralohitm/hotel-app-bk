const express = require('express');
const db = require('../config/db');
const db2 = require('../config/db_pool');
const roomRouter = express.Router();

  
// Helper function to generate dynamic SQL
const generateDynamicSQL = (data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");
    return { keys, values, placeholders };
  };


//Fetch all rooms 
roomRouter.get("/rooms", (req, res) => {
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

//Fetch avaiable rooms 
roomRouter.get("/avl_rooms", async (req, res) => {
    try {
        const { motel_id, roomtypename } = req.query;
        const connection = await db2.getConnection();
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
            //console.log(roomType[0].roomtype_id)

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

// Reservation API
roomRouter.post('/reserve', async (req, res) => {
    const { guest, room, reservation, billing } = req.body;
    const connection = await db2.getConnection();
    
    try {
      await connection.beginTransaction();
  
      // Get room_id and motel_id
      const [roomData] = await connection.execute(
        `SELECT room_id, motel_id FROM room WHERE roomnumber = ?`, 
        [room.roomnumber]
      );
      if (roomData.length === 0) throw new Error("Room not found");
  
      const { room_id, motel_id } = roomData[0];
  
      // Get roomtype_id
      const [roomTypeData] = await connection.execute(
        `SELECT roomtype_id FROM room_type WHERE roomtypename = ?`, 
        [room.roomtypename]
      );
      if (roomTypeData.length === 0) throw new Error("Room type not found");
  
      const { roomtype_id } = roomTypeData[0];
      //console.log(roomtype_id)
      // Get rate_id
      const [rateData] = await connection.execute(
        `SELECT rate_id FROM room_rates WHERE roomtype_id = ?`,
        [roomtype_id]
      );
      //console.log(rateData)
      if (rateData.length === 0) throw new Error("Rate not found");
  
      const { rate_id } = rateData[0];
  
      // Insert guest details dynamically
      if (Object.keys(guest).length === 0) throw new Error("Guest information required");
  
      const { keys: guestKeys, values: guestValues, placeholders: guestPlaceholders } = generateDynamicSQL(guest);
      
      const [guestResult] = await connection.execute(
        `INSERT INTO guest_profiles (${guestKeys.join(", ")}) VALUES (${guestPlaceholders})`,
        guestValues
      );
  
      const guest_id = guestResult.insertId;
      // Insert reservation
      const [reservationResult] = await connection.execute(
        `INSERT INTO reservations (guest_id, room_id, motel_id, rate_id, check_in_date, check_out_date, nights, adults, children, reference, rooms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guest_id, room_id, motel_id, rate_id, reservation.check_in_date, reservation.check_out_date, reservation.nights, reservation.adults, reservation.children, reservation.reference, reservation.rooms]
      );
  
      const reservation_id = reservationResult.insertId;
  
      // Insert guest transaction dynamically (if billing details are provided)
      if (Object.keys(billing).length > 0) {
        billing.reservation_id = reservation_id;
        billing.guest_id = guest_id;
  
        const { keys: billingKeys, values: billingValues, placeholders: billingPlaceholders } = generateDynamicSQL(billing);
        
        await connection.execute(
          `INSERT INTO guest_transactions (${billingKeys.join(", ")}) VALUES (${billingPlaceholders})`,
          billingValues
        );
      }
      const status = "booked";

      await connection.execute(`INSERT INTO room (current_booking_status) VALUES (?) WHERE room_id = ?`,[status,room_id]);
  
      await connection.commit();
      res.json({ success: true, message: "Reservation successful", reservation_id });
  
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ success: false, message: error.message });
    } finally {
      connection.release();
    }
  });

module.exports = roomRouter;