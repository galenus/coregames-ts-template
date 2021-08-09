import {Enum} from "./core-api-declarations";
import {CodeBlock} from "./code-block";
import {tag} from "./api-types";
import {mapType} from "./types-mapping";
import {ApiGenerationOptions} from "./types";

export function processEnums(enums: Enum[], fileCode: CodeBlock, options: ApiGenerationOptions) {
    enums
        .map(e => tag(e, "enum"))
        .forEach(enumDef => {
            const enumName = mapType(
                enumDef.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                    typedItemKey: enumDef.Name,
                }
            ).mappedType;
            return fileCode.scope(`declare enum ${enumName} {`)
                .addDescriptionAndDeprecationFor(enumDef)
                .add(
                    ...enumDef.Values
                        .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                        .map(({Name, Value}) => `${Name} = ${Value},`),
                );
        });
}
