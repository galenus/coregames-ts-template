import { Enum } from "./core-api-declarations";
import CodeWriter from "./type-definitions-writer";
import { withTag } from "./api-types";
import { mapType } from "./types-mapping";
import { ApiGenerationOptions } from "./types";

export default function processEnums(enums: Enum[], fileCode: CodeWriter, options: ApiGenerationOptions) {
    enums
        .map(e => withTag(e, "enum"))
        .forEach(enumDef => {
            const enumName = mapType(
                enumDef.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                    typedItemKey: enumDef.Name,
                },
            ).mappedType;
            return fileCode.scope(`declare enum ${enumName} {`)
                .addDescriptionAndDeprecationFor(enumDef)
                .add(
                    ...enumDef.Values
                        .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                        .map(({ Name, Value }) => `${Name} = ${Value},`),
                );
        });
}
