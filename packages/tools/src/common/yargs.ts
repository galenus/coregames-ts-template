import { Argv, Options } from "yargs";
import { assertPathExistence } from "./filesystem";

// eslint-disable-next-line import/prefer-default-export
export function withConfigOption(yargs: Argv, defaultPath?: string) {
    const options = {
        config: {
            type: "string",
            normalize: true,
            describe: "path to the tsconfig.json file used by typescript-to-lua for Lua compilation",
            coerce: (configPath: string) => {
                assertPathExistence(configPath);
                return configPath;
            },
        } as Options,
    };

    if (defaultPath) {
        assertPathExistence(defaultPath);
        options.config.default = defaultPath;
    } else {
        options.config.demandOption = true;
    }

    return yargs.options(options);
}
