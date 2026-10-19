// Infofilm's own wastebasket: a deleted film or sender is moved to ~/.infofilm/papperskorg/ and can be
// restored from there (Inställningar → Papperskorgen). Only "Töm papperskorgen" deletes for good.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HOME_DIR } from "./config.mjs";

export const TRASH = path.join(HOME_DIR, "papperskorg");
const ENTRY = /^\d{8}-\d{6}-(film|avsandare)-[A-Za-z0-9._-]+$/;
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

/** Move a folder, also across disks (rename fails with EXDEV there). */
function move(src, dst) {
  try {
    renameSync(src, dst);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    cpSync(src, dst, { recursive: true });
    rmSync(src, { recursive: true, force: true });
  }
}

/** Put a film's or a sender's folder in the wastebasket. kind: "film" | "avsandare". */
export function toTrash(kind, id, dir, name) {
  if (!existsSync(dir)) throw err("finns inte", 404);
  mkdirSync(TRASH, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const entry = `${stamp}-${kind}-${id}`;
  const dst = path.join(TRASH, entry);
  mkdirSync(dst, { recursive: true });
  move(dir, path.join(dst, "innehall"));
  writeFileSync(path.join(dst, "raderat.json"), JSON.stringify({ kind, id, name: name || id, original: dir, deletedAt: Date.now() }, null, 2) + "\n");
  return entry;
}

export function listTrash() {
  if (!existsSync(TRASH)) return [];
  return readdirSync(TRASH)
    .filter((e) => ENTRY.test(e))
    .map((entry) => {
      try {
        const meta = JSON.parse(readFileSync(path.join(TRASH, entry, "raderat.json"), "utf8"));
        return { entry, ...meta, exists: existsSync(meta.original) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Put it back where it was, unless something new lives there now. */
export function restore(entry) {
  if (!ENTRY.test(entry || "")) throw err("ogiltig post");
  const dir = path.join(TRASH, entry);
  const meta = JSON.parse(readFileSync(path.join(dir, "raderat.json"), "utf8"));
  if (existsSync(meta.original)) throw err(`det finns redan något på ${meta.original}: byt namn på det först`, 409);
  mkdirSync(path.dirname(meta.original), { recursive: true });
  move(path.join(dir, "innehall"), meta.original);
  rmSync(dir, { recursive: true, force: true });
  return meta;
}

/** Delete for good: the whole wastebasket, or one entry. */
export function emptyTrash(entry) {
  if (entry) {
    if (!ENTRY.test(entry)) throw err("ogiltig post");
    rmSync(path.join(TRASH, entry), { recursive: true, force: true });
    return 1;
  }
  const all = listTrash();
  for (const e of all) rmSync(path.join(TRASH, e.entry), { recursive: true, force: true });
  return all.length;
}

/** How much the wastebasket holds, in bytes (shown next to "Töm"). */
export function trashSize() {
  const walk = (p) => {
    const st = statSync(p);
    return st.isDirectory() ? readdirSync(p).reduce((n, f) => n + walk(path.join(p, f)), 0) : st.size;
  };
  return existsSync(TRASH) ? walk(TRASH) : 0;
}
