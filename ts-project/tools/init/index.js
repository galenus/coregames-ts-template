var fs = require('fs');
var path = require('path');
var os = require('os');
var simpleGit = require('simple-git');
var yargs = require('yargs/yargs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var os__default = /*#__PURE__*/_interopDefaultLegacy(os);
var simpleGit__default = /*#__PURE__*/_interopDefaultLegacy(simpleGit);
var yargs__default = /*#__PURE__*/_interopDefaultLegacy(yargs);

function processFilesRecursively(rootFolderPath, fileHandler, folderHandler) {
  const entries = fs__default['default'].readdirSync(rootFolderPath);
  entries.forEach(entry => {
    const fullEntryPath = path__default['default'].join(rootFolderPath, entry);

    if (fs__default['default'].statSync(fullEntryPath).isDirectory()) {
      if (!folderHandler || folderHandler(fullEntryPath)) {
        processFilesRecursively(fullEntryPath, fileHandler);
      }

      return;
    }

    fileHandler(fullEntryPath);
  });
}

const DEFAULT_REPOSITORY_URL = "https://github.com/galenus/coregames-ts-template.git";
const DEFAULT_BRANCH_NAME = "feature/convert-to-template";
const git = simpleGit__default['default']();
const currentFolder = process.cwd();
const {
  repo,
  branch
} = yargs__default['default'](process.argv.slice(2)).usage("Usage: init [--repo {repo URL}] [--branch {branch name}]").options({
  repo: {
    type: "string",
    default: DEFAULT_REPOSITORY_URL,
    describe: "location of the Git repository to use as a template"
  },
  branch: {
    type: "string",
    default: DEFAULT_BRANCH_NAME,
    describe: "name of the branch to use from the template Git repository"
  }
}).parseSync();

async function initForExistingGitRepo() {
  const tempFolderPath = fs__default['default'].mkdtempSync(path__default['default'].join(os__default['default'].tmpdir(), "init-core-ts"));
  const cloneDestinationPath = path__default['default'].join(tempFolderPath, "cloned");
  await git.clone(repo, cloneDestinationPath, {
    "--branch": branch,
    "--depth": 1
  });
  processFilesRecursively(cloneDestinationPath, file => {
    const destinationFilePath = path__default['default'].join(currentFolder, path__default['default'].basename(file));
    if (fs__default['default'].existsSync(destinationFilePath)) return;
    fs__default['default'].renameSync(file, destinationFilePath);
  }, folder => {
    const destinationFolderPath = path__default['default'].join(currentFolder, path__default['default'].basename(folder));

    if (!fs__default['default'].existsSync(destinationFolderPath)) {
      fs__default['default'].renameSync(folder, destinationFolderPath);
    }

    return false;
  });
  console.warn(`Current directory already contains Git repository.
Some files from the template may not initialize properly, compare the contents of this folder with the repository at ${repo}, ${branch} branch.`);
}

async function initForNewGitRepo() {
  await git.init();
  await git.addRemote("template", repo);
  await git.fetch("template", branch, {
    "--depth": 1
  });
  await git.checkout(`template/${branch}`);
  console.log(`Created a new Git repository in the current folder with support for TypeScript development.
Repository has a remote called 'template' pointing to repository at ${repo}. Feel free to delete this remote using 'git remote remove template'.`);
}

function handleResult() {
  console.log(`Initialized support for TypeScript in current folder successfully!
'cd ts-project', run 'npm install' and start hacking!`);
}

function handleError(e) {
  console.error("Could not initialize support for TypeScript due to an error:", e);
}

if (fs__default['default'].readdirSync(currentFolder).find(entry => path__default['default'].basename(entry) === ".git")) {
  initForExistingGitRepo().then(handleResult).catch(handleError);
} else {
  initForNewGitRepo().then(handleResult).catch(handleError);
}
