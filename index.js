require('dotenv').config();
const express = require('express');
const multer = require("multer");
const nodemailer = require("nodemailer");
const server = express();
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require("fs");
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const cookieParser = require('cookie-parser');
const { createProduct } = require('./controller/Product');
const productsRouter = require('./routes/Products');
const categoriesRouter = require('./routes/Categories');
const brandsRouter = require('./routes/Brands');
const usersRouter = require('./routes/Users');
const authRouter = require('./routes/Auth');
const cartRouter = require('./routes/Cart');
const ordersRouter = require('./routes/Order');
const paymentRouter = require('./routes/PaymentRoute'); // Import payment routes
const { User } = require('./model/User');
const { isAuth, sanitizeUser, cookieExtractor } = require('./services/common');
const path = require('path');
const { Order } = require('./model/Order');
const { env } = require('process');

console.log("EMAIL:", process.env.EMAIL); // Debugging
console.log("PASSWORD:", process.env.PASSWORD ? "Loaded" : "Missing");
console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL);

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const upload = multer({ dest: "uploads/" });
server.use(cors());
server.use(express.json());
// Webhook

const endpointSecret = process.env.ENDPOINT_SECRET;

server.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;

        const order = await Order.findById(
          paymentIntentSucceeded.metadata.orderId
        );
        order.paymentStatus = 'received';
        await order.save();

        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

// JWT options

const opts = {};
opts.jwtFromRequest = cookieExtractor;
opts.secretOrKey = process.env.JWT_SECRET_KEY; 

// Middlewares

server.use(express.static(path.resolve(__dirname, 'build')));
server.use(cookieParser());
server.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
  })
);
server.use(passport.authenticate('session'));
server.use(
  cors({
    exposedHeaders: ['X-Total-Count'],
  })
);
server.use(express.json()); // to parse req.body

// Routes
server.use('/products', isAuth(), productsRouter.router);
server.use('/categories', isAuth(), categoriesRouter.router);
server.use('/brands', isAuth(), brandsRouter.router);
server.use('/users', isAuth(), usersRouter.router);

server.use('/auth', authRouter.router);
server.use('/cart', isAuth(), cartRouter.router);
server.use('/orders', isAuth(), ordersRouter.router);
server.use('/payments', paymentRouter); // Use payment routes

// Fallback for React Router
server.get('*', (req, res) =>
  res.sendFile(path.resolve('build', 'index.html'))
);

// Passport Strategies
passport.use(
  'local',
  new LocalStrategy({ usernameField: 'email' }, async function (
    email,
    password,
    done
  ) {
    // by default passport uses username
    console.log({ email, password });
    try {
      const user = await User.findOne({ email: email });
      console.log(email, password, user);
      if (!user) {
        return done(null, false, { message: 'invalid credentials' }); // for safety
      }
      crypto.pbkdf2(
        password,
        user.salt,
        310000,
        32,
        'sha256',
        async function (err, hashedPassword) {
          if (!crypto.timingSafeEqual(user.password, hashedPassword)) {
            return done(null, false, { message: 'invalid credentials' });
          }
          const token = jwt.sign(
            sanitizeUser(user),
            process.env.JWT_SECRET_KEY
          );
          done(null, { id: user.id, role: user.role, token }); // this lines sends to serializer
        }
      );
    } catch (err) {
      done(err);
    }
  })
);

passport.use(
  'jwt',
  new JwtStrategy(opts, async function (jwt_payload, done) {
    try {
      const user = await User.findById(jwt_payload.id);
      if (user) {
        return done(null, sanitizeUser(user)); // this calls serializer
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
  })
);

// Serialize and Deserialize User
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, { id: user.id, role: user.role });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

server.post("/upload", upload.single("file"), async (req, res) => {
  const { email, randomNumber } = req.body;
  const file = req.file;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!email || !randomNumber || !file) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Step 1: Configure Nodemailer Transporter
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587, // Use 465 for SSL, 587 for TLS
    secure: false, // Use `true` for port 465
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD, // Must be an App Password
    },
  });

  // Step 2: Define Mail Options (Adding sender in CC)
  const mailOptions = {
    from: process.env.EMAIL,
    to: adminEmail, // Email sent to admin
    cc: email, // Sender's email in CC
    subject: "New STL File Submission",
    text: `You received a new STL file submission.\n\nUser Email: ${email}\nRandom Number: ${randomNumber}`,
    attachments: [
      {
        filename: file.originalname,
        path: file.path,
      },
    ],
  };
  try {
    // Step 3: Send the Email
    await transporter.sendMail(mailOptions);
    console.log("Sender is :", email);
    res.json({ message: "Email sent successfully to admin & sender (CC)!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  } finally {
    // Step 4: Ensure File is Deleted (whether success or error)
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log("File deleted successfully.");
    });
  }
});

// Start the server
main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Database connected');
}

server.listen(process.env.PORT, () => {
  console.log('Server started');
});

