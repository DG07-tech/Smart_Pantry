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
const {
  isLoggedIn,
  saveRedirectUrl,
  isOwner,
  validateInventory,
  validateUser,
} = require("./middleware.js");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bodyParser = require("body-parser");
const axios = require("axios");
const moment = require("moment"); // date formating
const methodOverride = require("method-override");
const cron = require("node-cron");

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
app.use(methodOverride("_method"));
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

// Function to delete expired items
async function deleteExpiredItems() {
  try {
    const result = await Inventory.deleteMany({
      expiryDate: { $lt: new Date() },
    });
    console.log(
      `Deleted ${result.deletedCount} expired pantry items for all users.`
    );
  } catch (err) {
    console.error("Error deleting expired items:", err);
  }
}

// Run cleanup on server startup
deleteExpiredItems();

// Schedule cron job to run daily at midnight to delte expire iteam
cron.schedule("0 0 * * *", deleteExpiredItems);

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

app.get("/payment", (req, res) => {
  res.render("users/payment.ejs");
});

// Dashboard route
app.get(
  "/dashboard",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    //username
    let username = req.user ? req.user.username : "Guest";
    // Count total items in the pantry
    const totalItems = await Inventory.countDocuments({ owner: req.user._id });

    // Count items expiring soon (within the next 7 days)
    const expiringItemsCount = await Inventory.countDocuments({
      expiryDate: {
        $lte: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      owner: req.user._id,
    });
    //category chart
    const results = await Inventory.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id: "$category", totalQuantity: { $sum: "$quantity" } } },
      { $sort: { totalQuantity: -1 } }, // Sort by total quantity
    ]);
    // Extract category names and quantities for Chart.js
    const categories = results.map((result) => result._id);
    const quantities = results.map((result) => result.totalQuantity);
    //expire iteam
    const upcomingExpiry = await Inventory.find({
      expiryDate: {
        $lte: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      owner: req.user._id,
    });
    upcomingExpiry.forEach((item) => {
      const daysLeft = Math.ceil(
        (item.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)
      );
      item.daysLeft = daysLeft;
    });
    res.render("dashboard/dashboard.ejs", {
      username,
      categories,
      quantities,
      upcomingExpiry,
      totalItems,
      expiringItemsCount,
    });
  })
);

app.get(
  "/dashboard/inventory",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const inventoryItems = await Inventory.find({ owner: req.user._id });

    res.render("dashboard/inventory.ejs", { inventoryItems, moment });
  })
);
app.get("/dashboard/addinventory", isLoggedIn, (req, res) => {
  res.render("dashboard/addinventory.ejs");
});

// Add inventory to database
app.post(
  "/dashboard/addinventory",
  isLoggedIn,
  validateInventory,
  wrapAsync(async (req, res) => {
    //Save inventory to the database
    const newInventory = new Inventory(req.body.inventory, {
      owner: req.user._id,
    });
    await newInventory.save();

    req.flash("success", "Inventory item added successfully!");
    res.redirect("/dashboard/inventory");
  })
);

// edit item
app.get(
  "/dashboard/inventory/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    const Inventoryitem = await Inventory.findById(id);
    res.render("dashboard/editinventory.ejs", { Inventoryitem });
  })
);

// update item
app.put(
  "/dashboard/inventory/:id",
  isLoggedIn,
  isOwner,
  validateInventory,
  wrapAsync(async (req, res) => {
    let { id } = req.params;

    await Inventory.findByIdAndUpdate(id, { ...req.body.inventory });
    res.redirect("/dashboard/inventory");
  })
);

// Delete inventory item
app.post(
  "/dashboard/inventory/delete/:id",
  isLoggedIn,
  isOwner,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Inventory.findByIdAndDelete(id);

    req.flash("success", "Inventory item deleted successfully!");
    res.redirect("/dashboard/inventory");
  })
);

// recipie suggestions
app.get(
  "/dashboard/recipes",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const userid = req.user._id;
    const inventoryItems = await Inventory.find({ owner: req.user._id });
    if (inventoryItems.length === 0) {
      return res.render("dashboard/recipes.ejs", {
        recipes: [],
        message: "No ingredients found in inventory.",
        userid,
      });
    }

    // Create a comma-separated list of ingredient names
    const ingredients = inventoryItems.map((item) => item.itemName).join(",");
    const apiUrl = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(
      ingredients
    )}&number=10&ranking=2&ignorePantry=true&apiKey=${
      process.env.SPOONACULAR_RECIPIE_KEY
    }`;

    // Call Spoonacular API and destructure the response
    const { data: recipes } = await axios.get(apiUrl);
    res.render("dashboard/recipes.ejs", { recipes, message: "", userid });
  })
);

async function getRecipeIngredients(recipeId) {
  const url = `https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${process.env.SPOONACULAR_RECIPIE_KEY}`;

  try {
    const response = await axios.get(url);

    // Extract ingredients from response
    return response.data.extendedIngredients.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount, // Amount (e.g., 2.0)
      unit: ingredient.unit, // Unit (e.g., cups, tbsp)
    }));
  } catch (error) {
    console.error("Error fetching recipe ingredients:", error);
    return [];
  }
}

async function getMissingIngredients(userId, recipeId) {
  const pantryItems = await Inventory.find({ userId });
  const recipeIngredients = await getRecipeIngredients(recipeId);

  const missingIngredients = recipeIngredients.filter((recipeIngredient) => {
    const pantryItem = pantryItems.find(
      (item) => item.name.toLowerCase() === recipeIngredient.name.toLowerCase()
    );
    return !pantryItem || pantryItem.quantity < recipeIngredient.amount;
  });

  return missingIngredients;
}

//shopping list
app.get(
  "/dashboard/shopping/:userId/:recipeId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { userId, recipeId } = req.params;
    const missingIngredients = await getMissingIngredients(userId, recipeId);
    res.render("dashboard/shoppinglist.ejs", { missingIngredients });
  })
);

// recipe search
app.get(
  "/dashboard/recipesearch",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { query, diet, cuisine, type, maxReadyTime } = req.query;
    const userid = req.user._id;
    // Validate search query input
    if (!query || query.trim() === "") {
      return res.status(400).render("dashboard/searchrecipes.ejs", {
        error: "Please enter a search term",
        searched: false,
        recipes: [],
        userid,
      });
    }

    // Build query parameters using conditional spreading
    const params = {
      apiKey: process.env.SPOONACULAR_RECIPIE_KEY,
      query: query.trim(),
      number: 10,
      addRecipeInformation: true,
      ignorePantry: true,
    };
    if (diet) params.diet = diet;
    if (cuisine) params.cuisine = cuisine;
    if (type) params.type = type;
    if (maxReadyTime) params.maxReadyTime = maxReadyTime;
    const { data } = await axios.get(
      "https://api.spoonacular.com/recipes/complexSearch",
      { params }
    );

    // Render results with search criteria so the form is pre-populated
    return res.render("dashboard/searchrecipes.ejs", {
      recipes: data.results,
      searched: true,
      userid,
    });
  })
);

app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});
app.post(
  "/signup",
  validateUser,
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
  async (req, res) => {
    req.flash("success", "Welcome to Smart Pantry");
    res.redirect("/home");
  }
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
