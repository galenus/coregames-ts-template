import path from "path";
import fs from "fs";
import { SourceFile } from "typescript";
import * as tstl from "typescript-to-lua";
import { CommandModule, Arguments, Argv } from "yargs";
import { withConfigOption } from "../common/yargs";

export interface BuildArguments {
    config: string;
    libRoot: string;
    libPattern: RegExp;
}

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "tsconfig.lua.json");
const DEFAULT_LIB_ROOT_OBJECT_NAME = "__TS__LibRoot";
const DEFAULT_LIB_PATTERN = "*+\\.lib\\.ts$";
const TYPEDEF_EXTENSION = ".d.ts";

function addLibraryScript(fileName: string, libRoot: string) {

}

function createWriteLuaScript(libFilePattern: RegExp, libRoot: string) {
    return (
        fileName: string,
        data: string,
        writeByteOrderMark: boolean,
        onError?: (message: string) => void,
        sourceFiles?: readonly SourceFile[],
    ) => {
        if (sourceFiles?.every(f => f.fileName.endsWith(TYPEDEF_EXTENSION))) return;

        try {
            fs.writeFileSync(fileName, data);
        } catch (e) {
            console.error(`Failed to write file ${fileName} due to an error: ${e}`);
            if (onError) {
                onError(`${e}`);
            }
        }

        if (sourceFiles?.length === 1 && libFilePattern.test(sourceFiles[0].fileName)) {
            addLibraryScript(fileName, libRoot);
        }
    };
}

function buildProject({ config, libRoot, libPattern }: Arguments<BuildArguments>) {
    const configFilePath = path.resolve(process.cwd(), config);
    tstl.transpileProject(
        configFilePath,
        {
            luaTarget: tstl.LuaTarget.Lua53,
            plugins: [{ name: "@coreg-ts/tstl-plugins/core-api-adapter", libRootName: libRoot }],
        },
        createWriteLuaScript(libPattern, libRoot),
    );
}

const yargsModule: CommandModule<{}, BuildArguments> = {
    builder: (
        yargs => withConfigOption(yargs, DEFAULT_CONFIG_PATH)
            .options({
                libRoot: {
                    type: "string",
                    describe: "name of the object in Core objects tree to use as library scripts storage",
                    default: DEFAULT_LIB_ROOT_OBJECT_NAME,
                },
                libPattern: {
                    type: "string",
                    describe: "RegExp pattern to match TypeScript library (shared functionality imported by other modules) file names",
                    default: DEFAULT_LIB_PATTERN,
                    coerce: (pattern: string) => new RegExp(pattern),
                },
            })
            .help()
    ) as ((args: Argv) => Argv<BuildArguments>),
    handler: args => buildProject(args),
};

export default yargsModule;
