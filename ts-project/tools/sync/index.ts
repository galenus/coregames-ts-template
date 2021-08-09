import fs from "fs";
import yargs from "yargs/yargs";
import path from "path";
import { assertPathExistence, loadTsProject, processFilesRecursively } from "../common/filesystem";

const ASSET_FILE_EXTENSION = ".asset.pbt";

const programArguments = yargs(process.argv.slice(2))
    .usage("Usage: sync --config /path/to/lua/tsconfig.json")
    .options({
        config: {
            type: "string",
            normalize: true,
            coerce: (configPath: string) => {
                assertPathExistence(configPath);
                return configPath;
            },
        },
    }).parseSync();

const project = loadTsProject(programArguments.config!);

const { rootDir, rootDirs, outDir } = project.compileOptions;

function createDestinationAssetFile(srcFileName: string) {
    fs.writeFileSync(path.join(outDir!, `${srcFileName}${ASSET_FILE_EXTENSION}`), "");
}

const destinationFiles: string[] = [];
processFilesRecursively(outDir!, file => path.basename(file));
(typeof rootDir === "string" ? [rootDir] : rootDirs!)
    .forEach(srcDir => processFilesRecursively(srcDir, file => {
        const srcFileName = path.basename(file, ".ts");
        if (destinationFiles.find(df => df === `${srcFileName}${ASSET_FILE_EXTENSION}`)) return;

        createDestinationAssetFile(srcFileName);
    }));
