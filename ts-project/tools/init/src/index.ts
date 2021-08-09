import fs from "fs";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { processFilesRecursively } from "../../common/filesystem";

const REPOSITORY_URL = "https://github.com/galenus/coregames-ts-template.git";
const BRANCH_NAME = "feature/convert-to-template";

const git = simpleGit();
const currentFolder = process.cwd();

async function initForExistingGitRepo() {
    const tempFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), "init-core-ts"));
    const cloneDestinationPath = path.join(tempFolderPath, "cloned");
    await git.clone(REPOSITORY_URL, cloneDestinationPath, { "--branch": BRANCH_NAME, "--depth": 1 });

    processFilesRecursively(
        cloneDestinationPath,
        file => {
            const destinationFilePath = path.join(currentFolder, path.basename(file));
            if (fs.existsSync(destinationFilePath)) return;
            fs.renameSync(file, destinationFilePath);
        },
        folder => {
            const destinationFolderPath = path.join(currentFolder, path.basename(folder));
            if (!fs.existsSync(destinationFolderPath)) {
                fs.renameSync(folder, destinationFolderPath);
            }

            return false;
        },
    );

    console.warn(`Current directory already contains Git repository.
Some files from the template may not initialize properly, compare the contents of this folder with the repository at ${REPOSITORY_URL}, ${BRANCH_NAME} branch.`);
}

async function initForNewGitRepo() {
    await git.init();
    await git.addRemote("template", REPOSITORY_URL);
    await git.fetch("template", BRANCH_NAME, { "--depth": 1 });
    await git.checkout(`template/${BRANCH_NAME}`);

    console.log(`Created a new Git repository in the current folder with support for TypeScript development.
Repository has a remote called 'template' pointing to repository at ${REPOSITORY_URL}. Feel free to delete this remote using 'git remote remove template'.`);
}

function handleResult() {
    console.log(`Initialized support for TypeScript in current folder successfully!
'cd ts-project', run 'npm install' and start hacking!`);
}

function handleError(e: Error) {
    console.error("Could not initialize support for TypeScript due to an error:", e);
}

if (fs.readdirSync(currentFolder).find(entry => path.basename(entry) === ".git")) {
    initForExistingGitRepo().then(handleResult).catch(handleError);
} else {
    initForNewGitRepo().then(handleResult).catch(handleError);
}
