import yargs from "yargs/yargs";
import init from "./init";
import apigen from "./api-generator";
import sync from "./sync";

yargs(process.argv.slice(2))
    .command("init", "Initializes a Core game directory for usage with TypeScript", init)
    .command("apigen", "Generates TypeScript definitions from Core Games API dump", apigen)
    .command("sync", "Synchronizes the files between the TypeScript source folder and Scripts destination folder", sync)
    .help()
    .parseAsync()
    .then(() => console.log("Done!"))
    .catch(e => console.error("Failed with an error:", e));
