const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);

const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
});

store.on("error", function (error) {
  console.log(error);
});

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 hour
  },
});

module.exports = sessionMiddleware;
