import { Class, Tag } from "./core-api-declarations";
import CodeWriter from "./type-definitions-writer";
import { mapType, OBJECT_CLASS_NAME } from "./types-mapping";
import { withTag } from "./api-types";
import {
    buildTypedEvent, buildTypedHook, EVENT_TYPE_NAME, HOOK_TYPE_NAME,
} from "./fields-processor";
import processFunctions from "./functions-processor";
import { ApiGenerationOptions } from "./types";

export default function processClasses(
    classes: Class[],
    fileCode: CodeWriter,
    options: ApiGenerationOptions,
) {
    function processClassInstanceMembers(classBlock: CodeWriter, currentClass: Class) {
        classBlock.section("PROPERTIES", true)
            .addDefinitionLines(
                currentClass.Properties
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(p => withTag(p, "property")),
                prop => {
                    const { mappedType } = mapType(prop.Type, {
                        parentDefinitionsStack: [currentClass],
                        typeUsage: "memberType",
                        typedItemKey: prop.Name,
                    });
                    return `${prop.Tags?.includes(Tag.ReadOnly) ? "readonly " : ""}${prop.Name}: ${mappedType};`;
                },
            );

        classBlock.section("EVENTS", true)
            .addDefinitionLines(
                (currentClass.Events ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(t => withTag(t, "event")),
                event => `readonly ${buildTypedEvent(event, currentClass)};`,
            );

        classBlock.section("HOOKS", true)
            .addDefinitionLines(
                (currentClass.Hooks ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(h => withTag(h, "hook")),
                hook => `readonly ${buildTypedHook(hook, currentClass)};`,
            );

        processFunctions(
            currentClass.MemberFunctions
                .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                .map(f => withTag(f, "function")),
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
        declarationOverrides?: StaticDeclarationOverrides,
    ) {
        if (!!currentClass.Constructors || !!currentClass.Constants || !!currentClass.StaticFunctions) {
            const mappedClassName: string = mapType(
                currentClass.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [currentClass],
                    typedItemKey: currentClass.Name,
                },
            ).mappedType;

            const staticTypeName = declarationOverrides?.staticTypeName ?? `${mappedClassName}Static`;
            const staticInstanceDeclaration = declarationOverrides?.staticInstanceDeclaration
                ?? `declare const ${mappedClassName}: ${staticTypeName};`;

            const staticClassBlock = fileCode.scope(`declare interface ${staticTypeName} {`);

            staticClassBlock.section("CONSTANTS", true)
                .addDefinitionLines(
                    (currentClass.Constants ?? []).map(c => withTag(c, "property")),
                    constant => {
                        const typeName = mapType(
                            constant.Type,
                            {
                                typeUsage: "memberType",
                                parentDefinitionsStack: [currentClass],
                                typedItemKey: constant.Name,
                            },
                        ).mappedType;
                        return `readonly ${constant.Name}: ${typeName};`;
                    },
                );

            processFunctions(
                (currentClass.Constructors ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(c => withTag(c, "function")),
                staticClassBlock.section("CONSTRUCTORS", true),
                true,
                currentClass,
            );
            processFunctions(
                (currentClass.StaticFunctions ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(f => withTag(f, "function")),
                staticClassBlock.section("STATIC METHODS", true),
                true,
                currentClass,
            );

            fileCode.add(staticInstanceDeclaration);
        }
    }

    const CONNECT_FUNC_NAME = "Connect";
    const HANDLER_TYPE_NAME = "THandler";

    function handleConnectableClasses(type: Class): boolean {
        if (!(type.Name === EVENT_TYPE_NAME || type.Name === HOOK_TYPE_NAME)) return false;

        const memberFunctions = type.MemberFunctions.filter(subj => !(options.omitDeprecated && subj.IsDeprecated));
        const connectFunc = memberFunctions.find(f => f.Name === CONNECT_FUNC_NAME)!;
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
                            { Name: "listener", Type: HANDLER_TYPE_NAME },
                            ...connectFuncParams.slice(connectFuncHandlerParamIndex + 1),
                        ],
                    }],
                },
                ...memberFunctions.filter(f => f.Name !== CONNECT_FUNC_NAME),
            ],
        };
        const classBlock = fileCode
            .scope(`declare interface ${type.Name}<${HANDLER_TYPE_NAME}> {`)
            .addDescriptionAndDeprecationFor(type);

        processClassInstanceMembers(classBlock, updatedClass);
        processClassStaticMembers(updatedClass);

        return true;
    }

    function handleObjectClass(type: Class): boolean {
        if (type.Name !== OBJECT_CLASS_NAME) return false;

        const typeName = mapType(
            OBJECT_CLASS_NAME,
            {
                typeUsage: "typeName",
                parentDefinitionsStack: [type],
                typedItemKey: type.Name,
            },
        ).mappedType;
        const classBlock = fileCode
            .scope(`declare interface ${typeName} {`)
            .addDescriptionAndDeprecationFor(type);

        processClassInstanceMembers(classBlock, type);
        processClassStaticMembers(type, {
            staticTypeName: "ObjectConstructor",
            staticInstanceDeclaration: "declare var Object: ObjectConstructor;",
        });

        return true;
    }

    function handleClassIfSpecial(type: Class): boolean {
        return handleConnectableClasses(type)
            || handleObjectClass(type);
    }

    classes
        .map(c => withTag(c, "class"))
        .forEach(currentClass => {
            if (handleClassIfSpecial(currentClass)) return;

            const baseTypeName = mapType(
                currentClass.BaseType ?? "",
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                },
            ).mappedType;
            const classExtendsClause = currentClass.BaseType
                ? ` extends ${baseTypeName}`
                : "";
            const typeName = mapType(
                currentClass.Name,
                {
                    typeUsage: "typeName",
                    parentDefinitionsStack: [],
                    typedItemKey: currentClass.Name,
                },
            ).mappedType;
            const classBlock = fileCode
                .scope(`declare interface ${typeName}${classExtendsClause} {`)
                .addDescriptionAndDeprecationFor(currentClass);

            processClassInstanceMembers(classBlock, currentClass);
            processClassStaticMembers(currentClass);
        });
}
