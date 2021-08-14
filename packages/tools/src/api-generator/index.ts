import fs from "fs";
import path from "path";
import { Arguments, CommandModule } from "yargs";
import loadApiDefinitions, { DEFAULT_API_DEFINITIONS_URL } from "./api-definitions-loader";
import processCoreApi from "./processors/api-definitions-processor";
import { assertPathExistence } from "../common/filesystem";

export interface ApiGeneratorArguments {
    url: string;
    output: string;
}

const yargsModule: CommandModule<{}, ApiGeneratorArguments> = {
    builder: yargs => yargs
        .options({
            url: {
                type: "string",
                default: DEFAULT_API_DEFINITIONS_URL,
                description: "URL of the Core Games API dump",
            },
            output: {
                type: "string",
                default: "./generated/core-api-definitions.d.ts",
                description: "path to the generated definitions file",
                normalize: true,
                coerce: (outputPath: string) => {
                    assertPathExistence(outputPath, "parent");

                    const requiredExtension = ".d.ts";
                    if (!outputPath.endsWith(requiredExtension)) {
                        const currentExtension = path.extname(outputPath);
                        if (!currentExtension) {
                            return outputPath + requiredExtension;
                        }

                        return outputPath.substring(0, outputPath.lastIndexOf(currentExtension)) + requiredExtension;
                    }

                    return outputPath;
                },
            },
        })
        .help(),
    handler: ({ url, output }: Arguments<ApiGeneratorArguments>) => loadApiDefinitions(url)
        .then(processCoreApi)
        .then(result => fs.writeFileSync(output, result.toString())),
};

export default yargsModule;
