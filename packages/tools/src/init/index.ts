import fs from "fs";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { Arguments, CommandModule } from "yargs";
import { processFilesRecursively } from "../common/filesystem";

const DEFAULT_REPOSITORY_URL = "https://github.com/galenus/coregames-ts-template.git";
const DEFAULT_BRANCH_NAME = "feature/convert-to-template";

const git = simpleGit();
const currentFolder = process.cwd();

export interface InitArguments {
    repo: string;
    branch: string,
}

async function initForExistingGitRepo({ repo, branch }: InitArguments) {
    const tempFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), "init-core-ts"));
    const cloneDestinationPath = path.join(tempFolderPath, "cloned");
    await git.clone(repo, cloneDestinationPath, { "--branch": branch, "--depth": 1 });

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
Some files from the template may not initialize properly, compare the contents of this folder with the repository at ${repo}, ${branch} branch.`);
}

async function initForNewGitRepo({ repo, branch }: InitArguments) {
    await git.init();
    await git.addRemote("template", repo);
    await git.fetch("template", branch, { "--depth": 1 });
    await git.checkout(`template/${branch}`);

    console.log(`Created a new Git repository in the current folder with support for TypeScript development.
Repository has a remote called 'template' pointing to repository at ${repo}. Feel free to delete this remote using 'git remote remove template'.`);
}

function handleResult() {
    console.log(`Initialized support for TypeScript in current folder successfully!
'cd ts-project', run 'npm install' and start hacking!`);
}

function handleError(e: Error) {
    console.error("Could not initialize support for TypeScript due to an error:", e);
}

const yargsModule: CommandModule<{}, InitArguments> = {
    builder: yargs => yargs
        .options({
            repo: {
                type: "string",
                default: DEFAULT_REPOSITORY_URL,
                describe: "location of the Git repository to use as a template",
            },
            branch: {
                type: "string",
                default: DEFAULT_BRANCH_NAME,
                describe: "name of the branch to use from the template Git repository",
            },
        })
        .help(),
    handler: (args: Arguments<InitArguments>) => {
        if (fs.readdirSync(currentFolder).find(entry => path.basename(entry) === ".git")) {
            initForExistingGitRepo(args).then(handleResult).catch(handleError);
        } else {
            initForNewGitRepo(args).then(handleResult).catch(handleError);
        }
    },
};

export default yargsModule;
