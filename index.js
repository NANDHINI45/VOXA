
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url'; 
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const port = 3000;
env.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.get("/logout", (req, res) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/home", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("home.ejs");
  } else {
    res.redirect("/login");
  }
});

app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

/*app.get("/auth/google/home", passport.authenticate("google", {
  successRedirect: "/home",
  failureRedirect: "/login",
}));*/
app.get("/auth/google/home", (req, res, next) => {
  passport.authenticate("google", (err, user, info) => {
    if (err) {
      console.error("❌ OAuth2 Error (Token Request Failure):", err);
      return res.status(500).send("OAuth2 Error: " + JSON.stringify(err));
    }
    if (!user) {
      console.log("⚠️ No user returned:", info);
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error("❌ Login Error:", err);
        return res.status(500).send("Login Failed");
      }
      return res.redirect("/home");
    });
  })(req, res, next);
});


app.post("/login", passport.authenticate("local", {
  successRedirect: "/home",
  failureRedirect: "/login",
}));

app.get("/", (req, res) => {
  res.render("start.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkresult = await db.query("SELECT * FROM logindetails WHERE emailid = $1", [email]);

    if (checkresult.rows.length > 0) {
      res.send("User already exists, try to login");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query("INSERT INTO logindetails (emailid, password) VALUES ($1, $2)", [email, hashedPassword]);
      res.render("home.ejs");
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/diary", async (req, res) => {
  const user_id = req.user ? req.user.user_id : null; // Ensure user_id is fetched correctly
  try {
    const result = await db.query("SELECT entry_date, content FROM diary WHERE user_id = $1 ORDER BY entry_date ASC", [user_id]);
    res.render("diary.ejs", { memories: result.rows });
  } catch (err) {
    console.log(err);
  }
});

app.post("/adddiary", async (req, res) => {
  
  const content = req.body.content;
  const entryDate = req.body.entryDate ? new Date(req.body.entryDate) : new Date();
  const user_id = req.user ? req.user.user_id : null;

  try {
    await db.query("INSERT INTO diary (user_id, content, entry_date) VALUES ($1, $2, $3)", [user_id, content, entryDate]);
    res.redirect("/diary");
  } catch (err) {
    console.log(err);
  }
});


app.get("/notes", async (req, res) => {
  const user_id = req.user ? req.user.user_id : null;

  if (!user_id) {
    return res.redirect("/login"); // Ensure the user is logged in
  }
  try {
    const result = await db.query("SELECT * FROM items WHERE user_id = $1 ORDER BY note_id ASC", [user_id]);
    const item = result.rows;
    res.render("notes.ejs", { listTitle: "Today", listItems: item });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error retrieving notes.");
  }
});

app.post("/add", async (req, res) => {
  const item = req.body.newItem;
  const completed = req.body.completed ? req.body.completed : false;
  const user_id = req.user ? req.user.user_id : null;

  if (!user_id) {
    return res.redirect("/login"); // Ensure the user is logged in
  }

  try {
    await db.query("INSERT INTO items (user_id, title, completed) VALUES ($1, $2, $3)", [user_id, item, completed]);
    res.redirect("/notes");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding note.");
  }
});

app.post("/edit", async (req, res) => {
  const item = req.body.updatedItemTitle;
  const id = req.body.updatedItemId;
  const user_id = req.user ? req.user.user_id : null;

  if (!user_id) {
    return res.redirect("/login"); // Ensure the user is logged in
  }

  try {
    await db.query("UPDATE items SET title = $1 WHERE note_id = $2 AND user_id = $3", [item, id, user_id]);
    res.redirect("/notes");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error updating note.");
  }
});

app.post("/delete", async (req, res) => {
  const id = req.body.deleteItemId;
  const user_id = req.user ? req.user.user_id : null;

  if (!user_id) {
    return res.redirect("/login"); // Ensure the user is logged in
  }

  try {
    await db.query("DELETE FROM items WHERE note_id = $1 AND user_id = $2", [id, user_id]);
    res.redirect("/notes");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting note.");
  }
});



// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});
const upload = multer({ storage });

// Upload image endpoint
app.post('/upload', upload.single('image'), async (req, res) => {
    const { user_id, content } = req.body;
    const file_name = req.file.filename;

    try {
        await db.query(
            'INSERT INTO photo_gallery (user_id, file_name, content) VALUES ($1, $2, $3)',
            [user_id, file_name, content]
        );
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading image');
    }
});

app.get('/gallery', async (req, res) => {
  const user_id = req.user ? req.user.user_id : null;

  if (!user_id) {
      return res.status(400).send('User ID is required');
  }

  try {
      const result = await db.query(
          'SELECT * FROM photo_gallery WHERE user_id = $1',
          [user_id]
      );
      res.render('photo_gallery', { images: result.rows });
  } catch (error) {
      console.error(error);
      res.status(500).send('Error retrieving images');
  }
});


// Delete image endpoint
app.delete('/images/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;

    try {
        const result = await db.query(
            'DELETE FROM photo_gallery WHERE id = $1 AND user_id = $2 RETURNING file_name',
            [id, user_id]
        );

        if (result.rows.length > 0) {
            fs.unlink(`./uploads/${result.rows[0].file_name}`, (err) => {
                if (err) console.error(err);
            });
        }
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting image');
    }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM logindetails WHERE emailid = $1", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password);
        if (valid) {
          return cb(null, user);
        } else {
          return cb(null, false);
        }
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

/*passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/home",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM logindetails WHERE emailid = $1", [profile.email]);
        if (result.rows.length === 0) {
          const newUser = await db.query("INSERT INTO logindetails (emailid, password) VALUES ($1, $2)", [profile.email, "google"]);
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);*/
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/home",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log("✅ Google Access Token:", accessToken);
        console.log("✅ Google Profile Email:", profile.email);

        const result = await db.query("SELECT * FROM logindetails WHERE emailid = $1", [profile.email]);

        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO logindetails (emailid, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        console.error("❌ Error in Google Strategy Callback:", err);
        return cb(err);
      }
    }
  )
);


passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

export default app;