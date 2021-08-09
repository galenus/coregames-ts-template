import { Function } from "./core-api-declarations";
import CodeWriter from "./code-writer";
import { Context } from "./api-types";
import { mapType, OBJECT_CLASS_NAME } from "./types-mapping";
import { buildSignature } from "./callables-processor";

const IS_A_FUNCTION = "IsA";

function handleSpecialFunction(
    func: Function,
    functionsSection: CodeWriter,
    staticFunctions: boolean,
    context: Context[],
) {
    const [root] = context;
    if (func.Name === IS_A_FUNCTION) {
        if (root?.Name === OBJECT_CLASS_NAME) {
            const typeName = mapType(
                OBJECT_CLASS_NAME,
                {
                    parentDefinitionsStack: context,
                    typeUsage: "typeName",
                    typedItemKey: root?.Name,
                },
            ).mappedType;

            functionsSection
                .section()
                .add(`${func.Name}<T extends ${typeName}>(): this is T;`);
        }

        return true;
    }

    return false;
}

export default function processFunctions(
    functions: Function[],
    functionsSection: CodeWriter,
    staticFunctions: boolean,
    owner: Context,
    declarationPrefix = "",
) {
    functions.forEach(func => {
        if (handleSpecialFunction(func, functionsSection, staticFunctions, [owner, func])) return;

        func.Signatures.forEach(signature => {
            const functionSignature = buildSignature(
                signature,
                [owner, func],
                { isStatic: staticFunctions },
            );
            functionsSection
                .section()
                .addDefinitionLine(
                    `${declarationPrefix}${func.Name}${functionSignature};`,
                    {
                        Description: signature.Description ?? func.Description,
                        IsDeprecated: signature.IsDeprecated ?? func.IsDeprecated,
                        DeprecationMessage: signature.DeprecationMessage ?? func.DeprecationMessage,
                    },
                );
        });
    });
}
