import {Enum} from "./core-api-declarations";
import {CodeBlock} from "./code-block";
import {tag} from "./api-types";
import {mapType} from "./types-mapping";

export function processEnums(enums: Enum[], fileCode: CodeBlock) {
    enums
        .map(e => tag(e, "enum"))
        .forEach(enumDef => {
            const enumName = mapType(
                enumDef.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                    typedItemName: enumDef.Name,
                }
            ).mappedType;
            return fileCode.scope(`declare enum ${enumName} {`)
                .addDescriptionAndDeprecationFor(enumDef)
                .add(
                    ...enumDef.Values.map(({Name, Value}) => `${Name} = ${Value},`),
                );
        });
}
