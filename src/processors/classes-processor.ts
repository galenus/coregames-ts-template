import {Class, Tag} from "../core-api-declarations";
import {CodeBlock} from "../code-block";
import {mapType, OBJECT_CLASS_NAME} from "../types-mapping";
import {tag} from "../api-types";
import {buildTypedEvent, buildTypedHook, EVENT_TYPE_NAME, HOOK_TYPE_NAME} from "./fields-processor";
import {processFunctions} from "./functions-processor";

function processClassInstanceMembers(classBlock: CodeBlock, currentClass: Class, fileCode: CodeBlock) {
    classBlock.section("PROPERTIES", true)
        .addDefinitionLines(
            currentClass.Properties.map(p => tag(p, "property")),
            prop => {
                const {mappedType} = mapType(prop.Type, {
                    parentDefinitionsStack: [currentClass],
                    typeUsage: "memberType",
                    typedItemName: prop.Name,
                });
                return `${prop.Tags?.includes(Tag.ReadOnly) ? "readonly " : ""}${prop.Name}: ${mappedType};`;
            },
        );

    classBlock.section("EVENTS", true)
        .addDefinitionLines(
            (currentClass.Events ?? []).map(t => tag(t, "event")),
            event => `readonly ${buildTypedEvent(event, currentClass)};`,
        );

    classBlock.section("HOOKS", true)
        .addDefinitionLines(
            (currentClass.Hooks ?? []).map(h => tag(h, "hook")),
            hook => `readonly ${buildTypedHook(hook, currentClass)};`,
        );

    processFunctions(
        currentClass.MemberFunctions.map(f => tag(f, "function")),
        classBlock.section("INSTANCE METHODS", true),
        false,
        currentClass,
    );
}

interface StaticDeclarationOverrides {
    staticTypeName?: string;
    staticInstanceDeclaration?: string;
}

function processClassStaticMembers(
    currentClass: Class,
    fileCode: CodeBlock,
    declarationOverrides?: StaticDeclarationOverrides,
) {
    if (!!currentClass.Constructors || !!currentClass.Constants || !!currentClass.StaticFunctions) {
        const mappedClassName: string = mapType(
            currentClass.Name,
            {
                typeUsage: "typeName",
                parentDefinitionsStack: [currentClass],
                typedItemName: currentClass.Name,
            }
        ).mappedType;

        const staticTypeName = declarationOverrides?.staticTypeName ?? `${mappedClassName}Static`;
        const staticInstanceDeclaration = declarationOverrides?.staticInstanceDeclaration
            ?? `declare const ${mappedClassName}: ${staticTypeName};`;

        const staticClassBlock = fileCode.scope(`declare interface ${staticTypeName} {`);

        staticClassBlock.section("CONSTANTS", true)
            .addDefinitionLines(
                (currentClass.Constants ?? []).map(c => tag(c, "property")),
                constant => {
                    const typeName = mapType(
                        constant.Type,
                        {
                            typeUsage: "memberType",
                            parentDefinitionsStack: [currentClass],
                            typedItemName: constant.Name,
                        }
                    ).mappedType;
                    return `readonly ${constant.Name}: ${typeName};`;
                },
            );

        processFunctions(
            (currentClass.Constructors ?? []).map(c => tag(c, "function")),
            staticClassBlock.section("CONSTRUCTORS", true),
            true,
            currentClass,
        );
        processFunctions(
            (currentClass.StaticFunctions ?? []).map(f => tag(f, "function")),
            staticClassBlock.section("STATIC METHODS", true),
            true,
            currentClass,
        );

        fileCode.add(staticInstanceDeclaration);
    }
}

const CONNECT_FUNC_NAME = "Connect";
const HANDLER_TYPE_NAME = "THandler";

function handleConnectableClasses(type: Class, fileCode: CodeBlock): boolean {
    if (!(type.Name === EVENT_TYPE_NAME || type.Name === HOOK_TYPE_NAME)) return false;

    const connectFunc = type.MemberFunctions.find(f => f.Name === CONNECT_FUNC_NAME)!;
    const connectFuncParams = connectFunc.Signatures[0].Parameters;
    const connectFuncHandlerParamIndex = connectFuncParams.findIndex(p => p.Name === "listener");
    const updatedClass: Class = {
        ...type,
        MemberFunctions: [
            {
                ...connectFunc,
                Signatures: [{
                    ...connectFunc.Signatures[0],
                    Parameters: [
                        ...connectFuncParams.slice(0, connectFuncHandlerParamIndex),
                        {Name: "listener", Type: HANDLER_TYPE_NAME},
                        ...connectFuncParams.slice(connectFuncHandlerParamIndex + 1),
                    ],
                }],
            },
            ...type.MemberFunctions.filter(f => f.Name !== CONNECT_FUNC_NAME),
        ],
    };
    const classBlock = fileCode
        .scope(`declare interface ${type.Name}<${HANDLER_TYPE_NAME}> {`)
        .addDescriptionAndDeprecationFor(type);

    processClassInstanceMembers(classBlock, updatedClass, fileCode);
    processClassStaticMembers(updatedClass, fileCode);

    return true;
}

function handleObjectClass(type: Class, fileCode: CodeBlock): boolean {
    if (type.Name !== OBJECT_CLASS_NAME) return false;

    const typeName = mapType(
        OBJECT_CLASS_NAME,
        {
            typeUsage: "typeName",
            parentDefinitionsStack: [type],
            typedItemName: type.Name,
        }
    ).mappedType;
    const classBlock = fileCode
        .scope(`declare interface ${typeName} {`)
        .addDescriptionAndDeprecationFor(type);

    processClassInstanceMembers(classBlock, type, fileCode);
    processClassStaticMembers(type, fileCode, {
        staticTypeName: "ObjectConstructor",
        staticInstanceDeclaration: "declare var Object: ObjectConstructor;",
    });

    return true;
}

function handleClassIfSpecial(type: Class, fileCode: CodeBlock): boolean {
    return handleConnectableClasses(type, fileCode)
        || handleObjectClass(type, fileCode);
}

export function processClasses(classes: Class[], fileCode: CodeBlock) {
    classes
        .map(c => tag(c, "class"))
        .forEach(currentClass => {
            if (handleClassIfSpecial(currentClass, fileCode)) return;

            const baseTypeName = mapType(
                currentClass.BaseType ?? "",
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                }
            ).mappedType;
            const classExtendsClause = currentClass.BaseType
                ? ` extends ${baseTypeName}`
                : "";
            const typeName = mapType(
                currentClass.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                    typedItemName: currentClass.Name,
                }
            ).mappedType;
            const classBlock = fileCode
                .scope(`declare interface ${typeName}${classExtendsClause} {`)
                .addDescriptionAndDeprecationFor(currentClass);

            processClassInstanceMembers(classBlock, currentClass, fileCode);
            processClassStaticMembers(currentClass, fileCode);
        });
}
