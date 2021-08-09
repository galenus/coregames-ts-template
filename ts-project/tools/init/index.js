/* eslint-disable */
var fs = require('fs');
var path = require('path');
var os = require('os');
var simpleGit = require('simple-git');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var os__default = /*#__PURE__*/_interopDefaultLegacy(os);
var simpleGit__default = /*#__PURE__*/_interopDefaultLegacy(simpleGit);

function processFilesRecursively(rootFolderPath, fileHandler, folderHandler) {
  const entries = fs__default['default'].readdirSync(rootFolderPath);
  entries.forEach(entry => {
    if (fs__default['default'].statSync(entry).isDirectory()) {
      if (!folderHandler || folderHandler(entry)) {
        processFilesRecursively(entry, fileHandler);
      }

      return;
    }

    fileHandler(entry);
  });
}

const REPOSITORY_URL = "https://github.com/galenus/coregames-ts-template.git";
const BRANCH_NAME = "feature/convert-to-template";
const git = simpleGit__default['default']();
const currentFolder = process.cwd();

async function initForExistingGitRepo() {
  const tempFolderPath = fs__default['default'].mkdtempSync(path__default['default'].join(os__default['default'].tmpdir(), "init-core-ts"));
  const cloneDestinationPath = path__default['default'].join(tempFolderPath, "cloned");
  await git.clone(REPOSITORY_URL, cloneDestinationPath);
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
Some files from the template may not initialize properly, compare the contents of this folder with the repository at ${REPOSITORY_URL}, ${BRANCH_NAME} branch.`);
}

async function initForNewGitRepo() {
  await git.init();
  await git.addRemote("template", REPOSITORY_URL);
  await git.fetch("template", BRANCH_NAME, {
    "--depth": 1
  });
  await git.checkout(`template/${BRANCH_NAME}`);
  console.log(`Created a new Git repository in the current folder with support for TypeScript development.
Repository has a remote called 'template' pointing to repository at ${REPOSITORY_URL}. Feel free to delete this remote using 'git remote remove template'.`);
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
