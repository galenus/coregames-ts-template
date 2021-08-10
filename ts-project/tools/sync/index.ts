import fs from "fs";
import yargs from "yargs/yargs";
import path from "path";
import { assertPathExistence, loadTsProject, processFilesRecursively } from "../common/filesystem";
import createAssetDefinition, { PlatformAssetType } from "../common/pbt-serialization";

const ASSET_FILE_EXTENSION = ".asset.pbt";

type SyncDirection = "ts2script" | "script2ts" | "both";

interface SyncArguments {
    direction: SyncDirection;
    config: string;
}

function getFileNameWithoutExtension(fileName: string, extension: string) {
    if (!fileName.endsWith(extension)) return fileName;
    return fileName.slice(0, -extension.length);
}

export default function syncFiles(args: SyncArguments) {
    const { config, direction } = args;
    const project = loadTsProject(config);
    const { rootDir, outDir } = project.compilerOptions;

    function createSourceFile(fileNameWithoutExtension: string, scriptFilePath: string) {
        const scriptContents = fs.readFileSync(scriptFilePath);
        const tsFilePath = path.join(rootDir!, `${fileNameWithoutExtension}.ts`);

        fs.writeFileSync(
            tsFilePath,
            Buffer.concat([
                Buffer.from("/* ORIGINAL SCRIPT CODE:\n"),
                scriptContents,
                Buffer.from("\n*/"),
            ]),
        );
        console.log(`Created ${tsFilePath} from script at ${scriptFilePath}`);
    }

    function createScriptAssetFile(fileNameWithoutExtension: string) {
        fs.writeFileSync(
            path.join(outDir!, `${fileNameWithoutExtension}${ASSET_FILE_EXTENSION}`),
            createAssetDefinition(PlatformAssetType.script, { name: fileNameWithoutExtension }),
        );
    }

    const destinationFiles = new Map<string, string>();
    processFilesRecursively(outDir!, file => destinationFiles.set(path.basename(file), file));

    const sourceFiles = new Map<string, string>();
    processFilesRecursively(rootDir!, file => {
        if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
            sourceFiles.set(path.basename(file), file);
        }
    });

    if (direction === "script2ts" || direction === "both") {
        destinationFiles.forEach((fileName, filePath) => {
            const fileNameWithoutExtension = getFileNameWithoutExtension(fileName, ".lua");
            if (fileName === fileNameWithoutExtension) return;

            if (!sourceFiles.has(`${fileNameWithoutExtension}.ts`)) {
                createSourceFile(fileNameWithoutExtension, filePath);
            }
        });
    }

    if (direction === "ts2script" || direction === "both") {
        sourceFiles.forEach(fileName => {
            const fileNameWithoutExtension = getFileNameWithoutExtension(fileName, ".ts");
            if (fileName === fileNameWithoutExtension) return;

            if (!destinationFiles.has(`${fileNameWithoutExtension}${ASSET_FILE_EXTENSION}`)) {
                createScriptAssetFile(fileNameWithoutExtension);
            }
        });
    }
}

if (require.main === module) {
    const programArguments = yargs(process.argv.slice(2))
        .usage("Usage: sync --config /path/to/lua/tsconfig.json --direction [ts2script | script2ts | both]")
        .options({
            config: {
                type: "string",
                normalize: true,
                demandOption: true,
                describe: "path to the tsconfig.json file used by typescript-to-lua for Lua compilation",
                coerce: (configPath: string) => {
                    assertPathExistence(configPath);
                    return configPath;
                },
            },
            direction: {
                choices: ["ts2script", "script2ts", "both"] as SyncDirection[],
                describe: "direction of the files synchronization",
                demandOption: true,
            },
        }).parseSync();

    syncFiles(programArguments);
}
