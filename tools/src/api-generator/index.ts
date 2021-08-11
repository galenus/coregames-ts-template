import fs from "fs";
import path from "path";
import yargs from "yargs/yargs";
import loadApiDefinitions from "./api-definitions-loader";
import processCoreApi from "./processors/api-definitions-processor";
import { assertPathExistence } from "../common/filesystem";

// noinspection JSUnusedGlobalSymbols
const programArguments = yargs(process.argv.slice(2))
    .usage("Usage: core-api-gen --output /path/to/generated-file.d.ts")
    .options({
        output: {
            type: "string",
            default: "./generated/core-api-definitions.d.ts",
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
    .parseSync();

loadApiDefinitions()
    .then(processCoreApi)
    .then(result => fs.writeFileSync(programArguments.output!, result.toString()))
    .then(() => console.log("Done!"))
    .catch(e => console.error("Failed with an error:", e));
