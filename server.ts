import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { usersDb, filesDb, logsDb, seedUsers } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

async function startServer() {
  await seedUsers();
  
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user: any = await usersDb.findOne({ username, password });
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    }
    res.status(401).json({ error: "Invalid credentials" });
  });

  app.post("/api/register", async (req, res) => {
    const { username, password, publicKey } = req.body;
    const existing = await usersDb.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username taken" });
    }

    const newUser = {
      id: uuidv4().substring(0, 9),
      username,
      password,
      role: "USER",
      publicKey,
    };
    await usersDb.insert(newUser);

    const { password: _, ...userWithoutPassword } = newUser;
    res.json(userWithoutPassword);
  });

  app.get("/api/users", async (req, res) => {
    const users = await usersDb.find({});
    const publicUsers = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      publicKey: u.publicKey,
    }));
    res.json(publicUsers);
  });

  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file part" });
    const metadataStr = req.body.metadata;
    if (!metadataStr) return res.status(400).json({ error: "No metadata" });

    const metadata = JSON.parse(metadataStr);
    const newFile = {
      ...metadata,
      id: uuidv4().substring(0, 9),
      serverPath: req.file.filename,
      timestamp: new Date().toISOString(),
    };
    await filesDb.insert(newFile);

    // Log the upload
    await logsDb.insert({
      id: uuidv4().substring(0, 9),
      timestamp: new Date().toISOString(),
      userId: metadata.ownerId,
      action: "UPLOAD",
      details: `file: ${metadata.name} | from: ${metadata.ownerName}`,
    });

    res.json(newFile);
  });

  app.get("/api/files/:userId", async (req, res) => {
    const { userId } = req.params;
    const userFiles = await filesDb.find({
      $or: [
        { sharedWith: { $elemMatch: userId } },
        { ownerId: userId }
      ]
    });
    res.json(userFiles);
  });

  app.get("/api/download/:fileId/:userId", async (req, res) => {
    const { fileId, userId } = req.params;
    const fileMeta: any = await filesDb.findOne({ id: fileId });
    if (!fileMeta) return res.status(404).send("File not found");

    // Log the download
    await logsDb.insert({
      id: uuidv4().substring(0, 9),
      timestamp: new Date().toISOString(),
      userId: userId,
      action: "DOWNLOAD",
      details: `file: ${fileMeta.name} | from: ${fileMeta.ownerName}`,
    });

    res.download(path.join(UPLOADS_DIR, fileMeta.serverPath), fileMeta.name);
  });

  app.post("/api/logs", async (req, res) => {
    const { userId, action, details } = req.body;
    const newLog = {
      id: uuidv4().substring(0, 9),
      timestamp: new Date().toISOString(),
      userId,
      action,
      details,
    };
    await logsDb.insert(newLog);
    res.json({ success: true });
  });

  app.get("/api/logs", async (req, res) => {
    const logs = await logsDb.find({}).sort({ timestamp: -1 });
    res.json(logs);
  });

  app.post("/api/update-user", async (req, res) => {
    const { userId, currentPassword, username, newPassword } = req.body;
    const user: any = await usersDb.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Current password incorrect" });
    }

    const update: any = {};
    if (username) {
      if (username !== user.username) {
        const existing: any = await usersDb.findOne({ username });
        if (existing) return res.status(400).json({ error: "Username taken" });
      }
      update.username = username;
    }

    if (newPassword) update.password = newPassword;

    await usersDb.update({ id: userId }, { $set: update });
    const updatedUser: any = await usersDb.findOne({ id: userId });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  });

  app.post("/api/revoke-access", async (req, res) => {
    const { fileId, recipientId } = req.body;
    const file: any = await filesDb.findOne({ id: fileId });
    if (!file) return res.status(404).json({ error: "File not found" });

    const newSharedWith = file.sharedWith.filter((uid: string) => uid !== recipientId);
    const update: any = { sharedWith: newSharedWith };
    
    if (file.recipientKeys) {
      const newKeys = { ...file.recipientKeys };
      delete newKeys[recipientId];
      update.recipientKeys = newKeys;
    }

    await filesDb.update({ id: fileId }, { $set: update });
    res.json({ success: true });
  });

  app.get("/api/storage-info", (req, res) => {
    res.json({
      type: "Embedded NeDB NoSQL",
      isCloud: false,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
