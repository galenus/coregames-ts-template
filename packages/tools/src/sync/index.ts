import fs from "fs";
import path from "path";
import { Arguments, CommandBuilder, CommandModule } from "yargs";
import { loadTsProject, processFilesRecursively } from "../common/filesystem";
import { withConfigOption } from "../common/yargs";
import { PlatformAssetType, createAssetDefinition } from "../common/pbt-serialization";

const ASSET_FILE_EXTENSION = ".asset.pbt";

type SyncDirection = "ts2script" | "script2ts" | "both";

export interface SyncArguments {
    direction: SyncDirection;
    config: string;
}

function getFileNameWithoutExtension(fileName: string, extension: string) {
    if (!fileName.endsWith(extension)) return fileName;
    return fileName.slice(0, -extension.length);
}

function syncFiles(args: SyncArguments) {
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
        const assetDefinitionPath = `${fileNameWithoutExtension}${ASSET_FILE_EXTENSION}`;
        fs.writeFileSync(
            path.join(outDir!, assetDefinitionPath),
            createAssetDefinition(PlatformAssetType.script, { name: fileNameWithoutExtension }),
        );
        console.log(`Created ${assetDefinitionPath} for script ${fileNameWithoutExtension}.ts`);
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
        destinationFiles.forEach((filePath, fileName) => {
            const fileNameWithoutExtension = getFileNameWithoutExtension(fileName, ".lua");
            if (fileName === fileNameWithoutExtension) return;

            if (!sourceFiles.has(`${fileNameWithoutExtension}.ts`)) {
                createSourceFile(fileNameWithoutExtension, filePath);
            }
        });
    }

    if (direction === "ts2script" || direction === "both") {
        sourceFiles.forEach((_, fileName) => {
            const fileNameWithoutExtension = getFileNameWithoutExtension(fileName, ".ts");
            if (fileName === fileNameWithoutExtension) return;

            if (!destinationFiles.has(`${fileNameWithoutExtension}${ASSET_FILE_EXTENSION}`)) {
                createScriptAssetFile(fileNameWithoutExtension);
            }
        });
    }
}

const yargsModule: CommandModule<{}, SyncArguments> = {
    builder: (
        yargs => withConfigOption(yargs)
            .options({
                direction: {
                    choices: ["ts2script", "script2ts", "both"] as SyncDirection[],
                    describe: "direction of the files synchronization",
                    demandOption: true,
                },
            })
            .help()
    ) as CommandBuilder<{}, SyncArguments>,
    handler: (argv: Arguments<SyncArguments>) => syncFiles(argv),
};

export default yargsModule;
