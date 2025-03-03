const express = require('express');
const cors = require('cors');
const motelRoutes = require('./routes/motels');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const roomrateRoutes = require('./routes/roomrates');
const roomtypeRoutes = require('./routes/roomtypes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', motelRoutes);
app.use('/api', roomRoutes);
app.use('/api', userRoutes);
app.use('/api',roomrateRoutes);
app.use('/api',roomtypeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// routing path
app.get('/', (req, res) => {
    res.send('Hello World!');
  });
  