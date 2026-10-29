import path from "node:path";
import { fileURLToPath } from "node:url";

/** جذر المستودع، بغض النظر عن المجلد الذي شُغّل منه الأمر. */
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const episodesDir = path.join(projectRoot, "episodes");
export const templatesDir = path.join(projectRoot, "templates");
