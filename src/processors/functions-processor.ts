import {Function} from "../core-api-declarations";
import {CodeBlock} from "../code-block";
import {Context} from "../api-types";
import {mapType, OBJECT_CLASS_NAME} from "../types-mapping";
import {buildSignature} from "./callables-processor";

const IS_A_FUNCTION = "IsA";
const SPECIAL_FUNCTION_NAMES = [IS_A_FUNCTION];

function handleSpecialFunction(
    func: Function,
    functionsSection: CodeBlock,
    staticFunctions: boolean,
    context: Context[],
) {
    const [root] = context;
    if (func.Name === IS_A_FUNCTION && root?.Name === OBJECT_CLASS_NAME) {
        const typeName = mapType(
            OBJECT_CLASS_NAME,
            {
                parentDefinitionsStack: context,
                typeUsage: "typeName",
                typedItemName: root?.Name,
            }
        ).mappedType;
        functionsSection
            .section()
            .add(`${func.Name}<T extends ${typeName}>(): this is T;`);
    }
}

export function processFunctions(
    functions: Function[],
    functionsSection: CodeBlock,
    staticFunctions: boolean,
    owner: Context,
    declarationPrefix = "",
) {
    functions.forEach(func => {
        if (SPECIAL_FUNCTION_NAMES.includes(func.Name)) {
            handleSpecialFunction(func, functionsSection, staticFunctions, [owner, func]);
            return;
        }

        func.Signatures.forEach(signature => {
            functionsSection
                .section()
                .addDefinitionLine(
                    `${declarationPrefix}${func.Name}${buildSignature(signature, [owner, func], {isStatic: staticFunctions})};`,
                    {
                        Description: signature.Description ?? func.Description,
                        IsDeprecated: signature.IsDeprecated ?? func.IsDeprecated,
                        DeprecationMessage: signature.DeprecationMessage ?? func.DeprecationMessage,
                    },
                );
        });
    });
}