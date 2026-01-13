import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static("public"));
app.use('/uploads', express.static('uploads'));

// Mock Data
const user = { user_id: 1, email: "preview@voxa.com" };

const memories = [
    { entry_date: new Date().toISOString(), content: "This is a sample diary entry. The UI looks clean and modern!" },
    { entry_date: new Date(Date.now() - 86400000).toISOString(), content: "Yesterday I worked on the new design system. Glassmorphism is really cool." },
    { entry_date: new Date(Date.now() - 172800000).toISOString(), content: "Had a great brainstorming session with the team." }
];

const notes = [
    { note_id: 1, title: "Review new UI designs" },
    { note_id: 2, title: "Fix database connection issues" },
    { note_id: 3, title: "Buy coffee beans" },
    { note_id: 4, title: "Schedule team meeting" }
];

const images = [
    // Empty for now to valid broken images, as we don't have files in uploads/
];

// Routes
app.get("/", (req, res) => res.render("start", { user: undefined }));
app.get("/login", (req, res) => res.render("login", { user: undefined }));
app.get("/register", (req, res) => res.render("register", { user: undefined }));

// Auth pages
app.get("/home", (req, res) => res.render("home", { user }));
app.get("/diary", (req, res) => res.render("diary", { user, memories }));
app.get("/notes", (req, res) => res.render("notes", { user, listTitle: "Preview Tasks", listItems: notes }));
app.get("/gallery", (req, res) => res.render("photo_gallery", { user, images }));

app.listen(port, () => {
    console.log(`✨ UI Preview Server running at http://localhost:${port}`);
    console.log(`- Start:   http://localhost:${port}/`);
    console.log(`- Home:    http://localhost:${port}/home`);
    console.log(`- Diary:   http://localhost:${port}/diary`);
    console.log(`- Notes:   http://localhost:${port}/notes`);
    console.log(`- Gallery: http://localhost:${port}/gallery`);
});
