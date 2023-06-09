const express = require('express');

const app = express();

const cors = require('cors');

require('dotenv').config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


// check weather server is running
app.get('/', (req, res) => {
    res.send('LinguaDove is Singing 🎵🎵🎵');
})

app.listen(port, () => {
    console.log('LinguaDove is singing on port ', port);
})
