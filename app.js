if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const Inventory = require("./models/inventory.js");
const wrapAsync = require("./utils/wrapAsync.js");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError.js");
const { isLoggedIn, saveRedirectUrl } = require("./middleware.js");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bodyParser = require("body-parser");
const axios = require("axios");

// MongoDB connection URL
const MONGO_URL = "mongodb://127.0.0.1:27017/smartpantry";

// Connect to MongoDB
main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

// Middleware configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use(bodyParser.urlencoded({ extended: true }));

// Session setup
const sessionOptions = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};
app.use(session(sessionOptions));
app.use(flash());

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/home",
    },
    async function (accessToken, refreshToken, profile, done) {
      const user = await User.findOne({
        googleId: profile.id,
      });
      if (!user) {
        const newUser = await User.create({
          username: profile.displayName,
          googleId: profile.id,
          photo: profile.photos[0].value,
          email: profile.emails[0].value,
        });
        await newUser.save();
        return done(null, newUser);
      } else {
        return done(null, user);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, {
    id: user.id,
    type: user.googleId ? "google" : "local",
  });
});

// Deserialize the user based on their type
passport.deserializeUser(async (userObj, done) => {
  try {
    const user = await User.findById(userObj.id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Flash message setup
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Home routes
app.get("/home", (req, res) => {
  res.render("pages/index.ejs");
});

// Other pages routes
app.get("/aboutus", (req, res) => {
  res.render("pages/aboutus.ejs");
});
app.get("/pricing", (req, res) => {
  res.render("pages/pricing.ejs");
});
app.get("/contactus", (req, res) => {
  res.render("pages/contactus.ejs");
});
app.get("/features", (req, res) => {
  res.render("pages/features.ejs");
});
app.get("/inventory", isLoggedIn, (req, res) => {
  res.render("users/inventory.ejs");
});

app.get("/payment", isLoggedIn, (req, res) => {
  res.render("users/payment.ejs");
});
app.get("/viewinventory", isLoggedIn, (req, res) => {
  res.render("users/viewinventory.ejs");
});

//*************************************************************************** */

// Notification route
app.get(
  "/notification",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    try {
      const today = new Date();
      const upcomingExpiry = await Inventory.find({
        expiryDate: {
          $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        owner: req.user._id,
      });
      res.render("users/notification.ejs", { upcomingExpiry });
    } catch (err) {
      console.error(err);
      req.flash("error", "Unable to fetch notifications");
      res.redirect("/home");
    }
  })
);

//********************************************************************************//

// Add inventory to database
app.post(
  "/inventory/add",
  wrapAsync(async (req, res) => {
    const { itemName, expiryDate, quantity } = req.body;
    try {
      // Save inventory to the database
      const newInventory = new Inventory({
        itemName,
        expiryDate,
        quantity,
        owner: req.user._id,
      });
      await newInventory.save();

      req.flash("success", "Inventory item added successfully!");
      res.redirect("/inventory");
    } catch (error) {
      console.error("Error adding inventory:", error);
      req.flash("error", "Failed to add inventory item.");
      res.redirect("/inventory");
    }
  })
);

// View inventory
app.get(
  "/inventory/view",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    try {
      const inventoryItems = await Inventory.find({ owner: req.user._id });
      res.render("users/viewinventory", { inventoryItems });
    } catch (err) {
      console.error(err);
      req.flash("error", "Unable to fetch inventory items");
      res.redirect("/viewinventory");
    }
  })
);

// Delete inventory item
app.post(
  "/inventory/delete/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    try {
      const { id } = req.params;
      await Inventory.findByIdAndDelete(id);

      req.flash("success", "Inventory item deleted successfully!");
      res.redirect("/inventory/view");
    } catch (err) {
      console.error(err);
      req.flash("error", "Failed to delete inventory item.");
      res.redirect("/inventory/view");
    }
  })
);

// recipie suggestions
app.get(
  "/recipies",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    try {
      const inventoryItems = await Inventory.find({ owner: req.user._id });
      if (inventoryItems.length === 0) {
        res.render("pages/recipies.ejs", {
          recipes: [],
          message: "No ingredients found in inventory.",
        });
      } else {
        const ingredients = inventoryItems
          .map((item) => item.itemName)
          .join(",");
        const apiUrl = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(
          ingredients
        )}&number=10&ranking=1&ignorePantry=true&apiKey=${
          process.env.SPOONACULAR_RECIPIE_KEY
        }`;

        // Call Spoonacular API
        const response = await axios.get(apiUrl);
        res.render("pages/recipies.ejs", {
          recipes: response.data,
          message: "",
        });
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  })
);

app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});
app.post(
  "/signup",
  wrapAsync(async (req, res) => {
    try {
      let { username, email, password } = req.body;
      const newUser = new User({ email, username });
      const registeredUser = await User.register(newUser, password);
      req.login(registeredUser, (err) => {
        if (err) {
          return next(err);
        }
        req.flash("success", "user was registered");
        res.redirect("/home");
      });
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/signup");
    }
  })
);

app.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

app.post(
  "/login",
  saveRedirectUrl,
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  wrapAsync(async (req, res) => {
    req.flash("success", "Welcome to Smart Pantry");
    res.redirect("/home");
  })
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
    }
    req.flash("success", "you are logged out");
    res.redirect("/home");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/home",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.flash("success", "Welcome to Smart Pantry");
    res.redirect("/home");
  }
);

app.get("/", (req, res) => {
  res.render("pages/index.ejs");
});

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
