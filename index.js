const express = require('express');

const app = express();

const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// check weather server is running
app.get('/', (req, res) => {
    res.send('LinguaDove is Singing 🎵🎵🎵');
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.kteeg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    client.connect((err) => {
      if(err){
        console.error(err);
        return;
      }
    });





    const classCollection = client.db('LinguaDove').collection('classCollection');
    const teacherCollection = client.db('LinguaDove').collection('teacherCollection');
    const userCollection = client.db('LinguaDove').collection('userCollection');
    const selectedClassCollection = client.db('LinguaDove').collection('selectedClassCollection');
    const paymentCollection = client.db('LinguaDove').collection('payments');

    // verify json web token

    const verifyJWT = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
      }
      // bearer token
      const token = authorization.split(' ')[1];
    
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    // verify admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // verify Instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // get all classes
    app.get('/classes', async(req, res) => {
        const result = await classCollection.find().sort({enrolled: -1}).toArray();
        res.send(result);
      })

    // get class for instrucotr
    app.get('/classes/:email', verifyJWT, verifyInstructor, async(req, res) => {
        const instructorEmail = req.params.email;
        const query = {instructor_email: instructorEmail}
        const result = await classCollection.find(query).toArray();
        // console.log('working');
        res.send(result);
      })

    // add  class to selected collection for specific user
    app.post('/selectclass', verifyJWT, async (req, res) => {
      const newClass = req.body;
      const result = await selectedClassCollection.insertOne(newClass);
      res.send(result);
    })
    // get all the selected classes
    app.get('/selectclass/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    // delete selected classes
    app.delete('/selectclass/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = {selectedClassId: id};
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })
    // get select class for payments

    app.get('/paymentinfo/:id', async (req, res) => {
      const id = req.params.id;
      const query = {selectedClassId: id};
      const result = await selectedClassCollection.findOne(query);
      res.send(result);
    })

    // get specific class information
    app.get('/classinfo/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await classCollection.findOne(query);
      res.send(result);
    })

    // get all teacher
    app.get('/teachers', async(req, res) => {
        const result = await teacherCollection.find().toArray();
        res.send(result);
      })


      // manage payments

        // create payment intent
      app.post('/create-payment-intent', verifyJWT,  async (req, res) => {
       
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // saving payment history to database

      // payment related api
  app.post('/payments', async(req, res) => {
    const payment = req.body;
    const {classId, deleteId} = payment;
    // console.log(classId);
    const filter = {_id : new ObjectId(classId)};
    const filter2 = {_id: new ObjectId(deleteId)};
    const deleteSelectedClass = await selectedClassCollection.deleteOne(filter2);
    const classInfo = await classCollection.findOne(filter);
    
    // console.log(classInfo);
    const totalEnrolled = classInfo?.enrolled ? classInfo.enrolled + 1 : 1;
    const availableSeat = classInfo.available_seat - 1;
    const updateDoc = {
      $set: {
        enrolled: totalEnrolled,
        available_seat: availableSeat
      },
    };

    const updateClass = await classCollection.updateOne(filter, updateDoc);
    const result = await paymentCollection.insertOne(payment);
    res.send(result);
  })

  

// enrolled classes

app.get('/enrolledclasses/:email', verifyJWT, async(req, res) => {
  const email = req.params.email;
  const query = {email : email};
  const result = await paymentCollection.find(query).toArray();
  // console.log('working');
  res.send(result);
})


    // users management
    // get users 
     // users related apis
     app.get('/users', verifyJWT, verifyAdmin,  async (req, res) => {
      const result = await userCollection.find().toArray();
      // console.log('working');
      res.send(result);
    });



    // create user 
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // promote user to admin
    app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      
      res.send(result);

    })

    // check wether a user is an admin or not
    app.get('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    // check wether a user is an instructor or not
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      

      res.send(result);
    })

    // approve a class
    app.patch('/class/admin/approve/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    // feedback for class from admin
    app.patch('/class/admin/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const {feedback} = req.body;
      // console.log(id, feedback);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    // deny a class
    app.patch('/class/admin/deny/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })


    // promote user to instructor
    app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      const getUser = await userCollection.findOne(filter);
      console.log(getUser);
      const addedToTeacher = await teacherCollection.insertOne(getUser);
      res.send(result);

    })

    // managing classes

    // adding new class 
    app.post('/newclass', verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      newClass.status="pending";
      const result = await classCollection.insertOne(newClass)
      res.send(result);
    })
    app.patch('/newclass/:id', verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)};

      const newClass = req.body;
      const updateDoc = {
        $set: {
          name: newClass.name,
          price: newClass.price,
          available_seat: newClass.available_seat,
          number_of_lesson: newClass.number_of_lesson
          
        },
      };
  
      const result = await classCollection.updateOne(filter, updateDoc);
      

      
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log('LinguaDove is singing on port ', port);
})
