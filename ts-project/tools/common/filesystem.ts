import path from "path";
import fs from "fs";
import { Project } from "./types";

export function assertPathExistence(pathToCheck: string, validationType: "parent" | "full" = "full") {
    if (validationType === "full") {
        fs.statSync(pathToCheck);
        return;
    }

    const parentFolder = path.dirname(pathToCheck);
    const stat = fs.statSync(parentFolder);
    if (!stat.isDirectory()) throw new Error(`${parentFolder} in specified path is not a directory`);
}

export function loadTsProject(configPath: string) {
    const project: Project = JSON.parse(fs.readFileSync(configPath).toString());
    return project;
}

export function processFilesRecursively(
    rootFolderPath: string,
    fileHandler: (filePath: string) => void,
    folderHandler?: (folderPath: string) => boolean,
) {
    const entries = fs.readdirSync(rootFolderPath);
    entries.forEach(entry => {
        if (fs.statSync(entry).isDirectory()) {
            if (!folderHandler || folderHandler(entry)) {
                processFilesRecursively(entry, fileHandler);
            }
            return;
        }

        fileHandler(entry);
    });
}
