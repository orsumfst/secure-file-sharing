import Datastore from "nedb-promises";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}

//  NeDB adatbazis táarolok  inicializalasa
export const usersDb = Datastore.create(path.join(DB_DIR, "users.db"));
export const filesDb = Datastore.create(path.join(DB_DIR, "files.db"));
export const logsDb = Datastore.create(path.join(DB_DIR, "logs.db"));

// alap felhasznalok letrehozasa futtataskor ha meg nincsenek
export async function seedUsers() {
  const count = await usersDb.count({});
  if (count === 0) {
    await usersDb.insert([
      { id: "1", username: "admin", role: "ADMIN", password: "password" },
      { id: "2", username: "alice", role: "USER", password: "password" },
      { id: "3", username: "bob", role: "USER", password: "password" },
      { id: "4", username: "charlie", role: "USER", password: "password" },
    ]);
  }
}
