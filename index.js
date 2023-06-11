const express = require('express');

const app = express();

const cors = require('cors');

require('dotenv').config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const data = require('./data.json');
const teachers = require('./teacher.json');


// check weather server is running
app.get('/', (req, res) => {
    res.send('LinguaDove is Singing 🎵🎵🎵');
})

app.get('/classes', (req, res) => {
    res.send(data);
})

app.get('/teachers', (req, res) => {
    res.send(teachers);
})

app.listen(port, () => {
    console.log('LinguaDove is singing on port ', port);
})
