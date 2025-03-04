const express = require('express');
const db = require('../config/db');
const motelRouter = express.Router();
const db2 = require('../config/db_pool');


// POST: Create a new motel and generate roomsgene
motelRouter.post('/motels', async (req, res) => {
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

  //Create Motel 
  motelRouter.post('/createmotel', async (req, res) => {
    const { Name, Location, max_rooms, rooms } = req.body;
    
    // Validate the form data
    if (!Name || !Location || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
        return res.status(400).json({ error: 'Invalid input. Name, Location, and Rooms are required.' });
    }

    const connection = await db2.getConnection();
    try {
        await connection.beginTransaction();

        // Insert the motel into the motel_details table
        const [motelResult] = await connection.query(
            'INSERT INTO motel_details (motel_name, motel_location, motel_max_rooms) VALUES (?, ?, ?)',
            [Name, Location, max_rooms]
        );
        const MotelID = motelResult.insertId;

        // Process each room and insert into the room table
        for (const room of rooms) {
            const { roomNumber, roomType } = room;
            
            if (!roomNumber || !roomType) {
                throw new Error('Invalid room data provided. Room Number and Room Type are required.');
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

            // Insert room into the room table
            await connection.query(
                'INSERT INTO room (motel_id, roomtype_id, roomnumber) VALUES (?, ?, ?)',
                [MotelID, roomTypeID, roomNumber]
            );
        }

        // Commit the transaction
        await connection.commit();
        res.json({ message: 'Motel and rooms created successfully', MotelID });
    } catch (err) {
        // Rollback in case of an error
        await connection.rollback();
        console.error('Error creating motel and rooms:', err.message);
        res.status(500).json({ error: 'Failed to create motel and rooms', details: err.message });
    } finally {
        connection.release();
    }
});



//// Add Rooms to Existing Motel
motelRouter.post('/motels/:id/rooms', async (req, res) => {
  const { id } = req.params;
  const { rooms } = req.body;

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: 'Invalid input. Rooms data is required.' });
  }

  const connection = await db2.getConnection();
  try {
      await connection.beginTransaction();

      for (const room of rooms) {
          const { roomNumber, roomType } = room;
          if (!roomNumber || !roomType) {
              throw new Error('Invalid room data provided. Room Number and Room Type are required.');
          }

          const [roomTypeResult] = await connection.query(
              'SELECT roomtype_id FROM room_type WHERE roomtypename = ?',
              [roomType]
          );

          if (roomTypeResult.length === 0) {
              throw new Error(`Room type "${roomType}" not found.`);
          }

          const roomTypeID = roomTypeResult[0].roomtype_id;

          await connection.query(
              'INSERT INTO room (motel_id, roomtype_id, roomnumber) VALUES (?, ?, ?)',
              [id, roomTypeID, roomNumber]
          );
      }

      await connection.commit();
      res.json({ message: 'Rooms added successfully' });
  } catch (err) {
      await connection.rollback();
      console.error('Error adding rooms:', err.message);
      res.status(500).json({ error: 'Failed to add rooms', details: err.message });
  } finally {
      connection.release();
  }
});



// Edit Room Details for an Existing Motel
motelRouter.put('/motels/:motelId/rooms/:roomId', async (req, res) => {
  const { motelId, roomId } = req.params;
  const { roomNumber, roomType } = req.body;

  if (!roomNumber && !roomType) {
      return res.status(400).json({ error: 'Invalid input. At least one of roomNumber or roomType is required.' });
  }

  const connection = await db2.getConnection();
  try {
      await connection.beginTransaction();

      // Check if room exists
      const [roomExists] = await connection.query(
          'SELECT * FROM room WHERE room_id = ? AND motel_id = ?',
          [roomId, motelId]
      );

      if (roomExists.length === 0) {
          throw new Error('Room not found for the given motel.');
      }

      // If roomType is provided, validate and get the room type ID
      if (roomType) {
          const [roomTypeResult] = await connection.query(
              'SELECT roomtype_id FROM room_type WHERE roomtypename = ?',
              [roomType]
          );

          if (roomTypeResult.length === 0) {
              throw new Error(`Room type "${roomType}" not found.`);
          }

          const roomTypeID = roomTypeResult[0].roomtype_id;

          // Update the room with new room type ID
          await connection.query(
              'UPDATE room SET roomtype_id = ? WHERE room_id = ? AND motel_id = ?',
              [roomTypeID, roomId, motelId]
          );
      }

      // If roomNumber is provided, update the room number
      if (roomNumber) {
          await connection.query(
              'UPDATE room SET roomnumber = ? WHERE room_id = ? AND motel_id = ?',
              [roomNumber, roomId, motelId]
          );
      }

      await connection.commit();
      res.json({ message: 'Room details updated successfully' });
  } catch (err) {
      await connection.rollback();
      console.error('Error updating room:', err.message);
      res.status(500).json({ error: 'Failed to update room', details: err.message });
  } finally {
      connection.release();
  }
});





//get motels along with room details grouped by room type
motelRouter.get("/motels", (req, res) => {
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

//Delete Motel  
motelRouter.delete("/motels/:id", async (req, res) => {
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
module.exports = motelRouter;