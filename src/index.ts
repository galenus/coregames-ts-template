import fs from "fs";
import path from "path";
import axios from "axios";
import yargs from "yargs/yargs";
import {
    Class,
    CoreAPI,
    DescribableDeprecatable,
    Function,
    Namespace,
    Parameter,
    Signature,
    Hook,
    Event,
    Tag,
    Enum, Property,
} from "./core-api-declarations";
import {argv} from "yargs";

const API_DEFINITIONS_URL = "https://raw.githubusercontent.com/ManticoreGamesInc/platform-documentation/development/src/assets/api/CoreLuaAPI.json";

async function loadApiDefinitions(): Promise<CoreAPI> {
    const response = await axios.get(API_DEFINITIONS_URL);
    return response.data as CoreAPI;
}

const OBJECT_CLASS_NAME = "Object";
const CORE_API_OBJECT_CLASS_NAME = "__CoreAPI__Object";
const TAB = "    ";
const FIRST_COMMENT_LINE = "/**";

class CodeBlock {
    private readonly code: (string | CodeBlock)[] = [];

    constructor(
        private readonly contentPrefix: string = "",
        private readonly firstLine?: string,
        private readonly lastLine?: string,
        private readonly wrapWithNewLines?: boolean,
        private readonly removeEmpty?: boolean,
    ) {
        if (firstLine) this.code.push(firstLine);
    }

    add(...codeLines: (string | false)[]) {
        this.code.push(...codeLines.filter(item => !!item).map(l => `${l}`));
        return this;
    }

    comment(addComments: (commentsBlock: CodeBlock) => void) {
        if (this.code[0] instanceof CodeBlock && this.code[0].firstLine === FIRST_COMMENT_LINE) {
            addComments(this.code[0]);
            return this;
        }

        const commentBlock = new CodeBlock(" * ", FIRST_COMMENT_LINE, " */");
        this.code.unshift(commentBlock);
        addComments(commentBlock);
        return this;
    }

    section(name?: string, wrapWithNewLines = false) {
        const section = new CodeBlock("", typeof name === "string" ? `// ${name}` : undefined, undefined, wrapWithNewLines, true);
        this.code.push(section);
        return section;
    }

    addAsSection(...lines: string[]) {
        return this.section().add(...lines);
    }

    scope(scopeDeclarationFirstLine: string, lastScopeLine: string | false = "}") {
        const scopeBlock = new CodeBlock(TAB, scopeDeclarationFirstLine, lastScopeLine || undefined, true);
        this.code.push(scopeBlock);

        return scopeBlock;
    }

    addDescriptionAndDeprecationFor({ Description, DeprecationMessage, IsDeprecated }: DescribableDeprecatable) {
        if (!Description && !IsDeprecated) return this;

        this.comment(c => c
            .add(Description ?? false)
            .add(IsDeprecated ? `@deprecated ${DeprecationMessage ?? ""}` : false));

        return this;
    }

    addDefinitionLine(declarationLine: string, definition: DescribableDeprecatable) {
        this.section()
            .add(declarationLine)
            .addDescriptionAndDeprecationFor(definition);

        return this;
    }

    addDefinitionLines<T extends DescribableDeprecatable>(definitions: T[], toDeclarationLine: (def: T) => string) {
        definitions.forEach(definition => this.addDefinitionLine(toDeclarationLine(definition), definition));
        return this;
    }

    getCodeLines(): string[] {
        if (this.removeEmpty && this.code.length === 1 && this.code[0] === this.firstLine) {
            return [];
        }

        return [
            ...this.wrapWithNewLines ? [""] : [],
            ...this.code.flatMap(code => {
                if (code === this.firstLine) {
                    return [code];
                }

                if (code instanceof CodeBlock) {
                    return code.getCodeLines().map(line => this.contentPrefix + line);
                }

                return code.split("\n")
                    .map(line => line.replace(/^\r|\r$/g, ""))
                    .map(line => this.contentPrefix + line);
            }),
            ...this.lastLine ? [this.lastLine] : [],
            ...this.wrapWithNewLines ? [""] : [],
        ];
    }

    toString() {
        return this.getCodeLines().join("\n");
    }
}

const INTEGER_TYPE_NAME = "Integer";
const OPTIONAL_TYPE_NAME = "Optional";
const MULTI_RETURN_TYPE_NAME = "LuaMultiReturn";

interface MapTypeResult {
    mappedType: string;
    isGeneric?: boolean;
}

type Tagged<T, Tags> = T & { tag: Tags };
type Context = Namespace | Class | Enum | Function | Event | Property | Hook;
type ContextTypeTags = "namespace" | "class" | "enum" | "function" | "event" | "property" | "hook";
type TaggedContext = Tagged<Context, ContextTypeTags>;

function tag<T extends Context, Tag extends ContextTypeTags>(def: T, tag: Tag): Tagged<T, Tag> {
    return {...def, tag};
}

function getTag(def: Context) {
    return (def as TaggedContext).tag;
}

function isTaggedWith(def: Context, tag: ContextTypeTags): boolean {
    return getTag(def) === tag;
}

const isNamespace = (def: Context): def is Namespace => isTaggedWith(def, "namespace");

const isClass = (def: Context): def is Class => isTaggedWith(def, "class");

const isEnum = (def: Context): def is Enum => isTaggedWith(def, "enum");

const isFunction = (def: Context): def is Function => isTaggedWith(def, "function");

const isEvent = (def: Context): def is Event => isTaggedWith(def, "event");

const isProperty = (def: Context): def is Property => isTaggedWith(def, "property");

const isHook = (def: Context): def is Hook => isTaggedWith(def, "hook");

type TypeUsage = "typeName" | "return" | "arg" | "memberType";

interface TypeContext {
    typeUsage: TypeUsage;
    typedItemName?: string;
    parentDefinitionsStack: Context[];
}

type MemberTags = Exclude<ContextTypeTags, "class" | "namespace" | "enum">

type TypesByItemName = Record<string, string>
type TypesByUsage = Partial<Record<TypeUsage, TypesByItemName>>
type TypesByMemberName = Record<string, TypesByUsage>
type TypesByMemberTag = Partial<Record<MemberTags, TypesByMemberName>>
type TypesByRoot = Record<string, TypesByMemberTag>

const specialNamespaceTypes: TypesByRoot = {
    World: {
        function: {
            SpawnAsset: {
                arg: {
                    optionalParameters: "{parent?: CoreObject, position?: Vector3, rotation?: Rotation | Quaternion, scale?: Vector3}"
                }
            }
        }
    }
}

function handleSpecialType(type: string, {parentDefinitionsStack, typeUsage, typedItemName}: TypeContext): MapTypeResult | false {
    if (parentDefinitionsStack.length < 2 || parentDefinitionsStack.find(subj => !subj)) return false;

    const root = parentDefinitionsStack[0];
    if (isNamespace(root)) {
        const member = parentDefinitionsStack[1];
        const mappedType = specialNamespaceTypes[root.Name]
            ?.[getTag(member) as MemberTags]
            ?.[member.Name ?? ""]
            ?.[typeUsage]
            ?.[typedItemName ?? ""];

        if (!mappedType) return false;

        return {mappedType};
    }

    return false;
}

function mapType(type: string, context?: TypeContext): MapTypeResult {
    const specialTypeHandlingResult = context && handleSpecialType(type, context);
    if (specialTypeHandlingResult) return specialTypeHandlingResult;

    switch (type) {
        case "integer": return { mappedType: INTEGER_TYPE_NAME };
        case "function": return { mappedType: "(...args: any[]) => void" };
        case "table": return { mappedType: "Record<string, any>" };
        case "value": return { mappedType: "any", isGeneric: true };
        case OBJECT_CLASS_NAME: return { mappedType: CORE_API_OBJECT_CLASS_NAME };
        case "": return { mappedType: "any" };
        case undefined: return { mappedType: "any" };
        default: return { mappedType: type };
    }
}

type Callable = Partial<Pick<Signature, "Parameters" | "Returns">>;

function getName(p: Parameter) {
    if (p.Name === "function") return "func";

    return p.Name?.replace(/ /g, "_");
}

interface SignatureOptions {
    isStatic?: boolean;
    isLambdaSignature?: boolean;
}

function buildSignature(
    { Parameters, Returns }: Callable,
    context: Context[],
    options?: SignatureOptions,
) {
    const { isStatic, isLambdaSignature } = options ?? {};

    const parameterDefs = Parameters?.map(p => {
        const { mappedType } = mapType(p.Type ?? "", {
            parentDefinitionsStack: context,
            typedItemName: p.Name,
            typeUsage: "arg"
        });
        return `${p.IsVariadic ? "..." : ""}${(getName(p))}${p.IsOptional ? "?" : ""}: ${mappedType}${p.IsVariadic ? "[]" : ""}`;
    });

    const returnDefs: string[] = [];
    const genericParams: string[] = [];
    let genericParamsCount = 0;
    for (let index = 0; index < (Returns?.length ?? 0); index++) {
        const ret = Returns![index];
        // eslint-disable-next-line prefer-const
        let { mappedType, isGeneric } = mapType(ret.Type ?? "", {
            typeUsage: "return",
            parentDefinitionsStack: context,
        });
        if (isGeneric) {
            genericParamsCount++;
            const originalMappedType = mappedType;
            mappedType = `T${genericParamsCount}`;
            genericParams.push(`${mappedType} = ${originalMappedType}`);
        }
        const retDef = `${ret.IsOptional ? `${OPTIONAL_TYPE_NAME}<` : ""}${mappedType}${ret.IsOptional ? ">" : ""}${ret.IsVariadic ? "[]" : ""}`;
        returnDefs.push(retDef);
    }

    if (isStatic) {
        parameterDefs?.unshift("this: void");
    }
    const genericParamsPrefix = genericParams.length > 0 ? `<${genericParams.join(",")}>` : "";
    const invocation = `${genericParamsPrefix}(${parameterDefs?.join(", ") ?? ""})`;

    let returnType;
    if (!returnDefs?.length) {
        returnType = "void";
    } else if (returnDefs.length === 1) {
        [returnType] = returnDefs;
    } else {
        returnType = `${MULTI_RETURN_TYPE_NAME}<[${returnDefs.join(", ")}]>`;
    }

    return `${invocation}${isLambdaSignature ? " => " : ": "}${returnType}`;
}

const IS_A_FUNCTION = "IsA";
const SPECIAL_FUNCTION_NAMES = [IS_A_FUNCTION];

function handleSpecialFunction(
    func: Function,
    functionsSection: CodeBlock,
    staticFunctions: boolean,
    owner: Context,
    declarationPrefix: string,
) {
    if (func.Name === IS_A_FUNCTION && owner.Name === OBJECT_CLASS_NAME) {
        const typeName = mapType(
            OBJECT_CLASS_NAME,
            {
                parentDefinitionsStack: [owner],
                typeUsage: "typeName",
                typedItemName: owner.Name,
            }
        ).mappedType;
        functionsSection
            .section()
            .add(`${func.Name}<T extends ${typeName}>(): this is T;`);
    }
}

function processFunctions(
    functions: Function[],
    functionsSection: CodeBlock,
    staticFunctions: boolean,
    owner: Context,
    declarationPrefix = "",
) {
    functions.forEach(func => {
        if (SPECIAL_FUNCTION_NAMES.includes(func.Name)) {
            handleSpecialFunction(func, functionsSection, staticFunctions, func, declarationPrefix);
            return;
        }

        func.Signatures.forEach(signature => {
            functionsSection
                .section()
                .addDefinitionLine(
                    `${declarationPrefix}${func.Name}${buildSignature(signature, [owner, func], { isStatic: staticFunctions })};`,
                    {
                        Description: signature.Description ?? func.Description,
                        IsDeprecated: signature.IsDeprecated ?? func.IsDeprecated,
                        DeprecationMessage: signature.DeprecationMessage ?? func.DeprecationMessage,
                    },
                );
        });
    });
}

const EVENT_TYPE_NAME = "Event";
function buildTypedEvent(event: Event, parentDef: Context) {
    return `${event.Name}: ${EVENT_TYPE_NAME}<${buildSignature(event, [parentDef], { isStatic: true, isLambdaSignature: true })}>`;
}

const HOOK_TYPE_NAME = "Hook";
function buildTypedHook(hook: Hook, parentDef: Context) {
    return `${hook.Name}: ${HOOK_TYPE_NAME}<${buildSignature(hook, [parentDef], { isStatic: true, isLambdaSignature: true })}>`;
}

function processClassMembers(classBlock: CodeBlock, currentClass: Class, fileCode: CodeBlock) {
    classBlock.section("PROPERTIES", true)
        .addDefinitionLines(
            currentClass.Properties.map(p => tag(p, "property")),
            prop => {
                const { mappedType } = mapType(prop.Type, {
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

function processClassStatics(
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
                        { Name: "listener", Type: HANDLER_TYPE_NAME },
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

    processClassMembers(classBlock, updatedClass, fileCode);
    processClassStatics(updatedClass, fileCode);

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

    processClassMembers(classBlock, type, fileCode);
    processClassStatics(type, fileCode, {
        staticTypeName: "ObjectConstructor",
        staticInstanceDeclaration: "declare var Object: ObjectConstructor;",
    });

    return true;
}

function handleClassIfSpecial(type: Class, fileCode: CodeBlock): boolean {
    return handleConnectableClasses(type, fileCode)
        || handleObjectClass(type, fileCode);
}

function processClasses(classes: Class[], fileCode: CodeBlock) {
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

                processClassMembers(classBlock, currentClass, fileCode);
                processClassStatics(currentClass, fileCode);
            });
}

function processNamespaceMembers(namespaceBlock: CodeBlock, namespace: Namespace) {
    namespaceBlock.section("EVENTS")
        .addDefinitionLines(
            (namespace.StaticEvents ?? []).map(e => tag(e, "event")),
            event => `export const ${buildTypedEvent(event, namespace)};`,
        );

    namespaceBlock.section("HOOKS")
        .addDefinitionLines(
            (namespace.StaticHooks ?? []).map(h => tag(h, "hook")),
            hook => `export const ${buildTypedHook(hook, namespace)};`,
        );

    processFunctions(
        namespace.StaticFunctions.map(f => tag(f, "function")),
        namespaceBlock.section("FUNCTIONS"),
        true,
        namespace,
        "export function ",
    );
}

function processNamespaces(namespaces: Namespace[], fileCode: CodeBlock) {
    namespaces
        .map(n => tag(n, "namespace"))
        .forEach(namespace => {
            const namespaceBlock = fileCode
                .scope(`declare namespace ${namespace.Name} {`)
                .addDescriptionAndDeprecationFor(namespace);

            processNamespaceMembers(namespaceBlock, namespace);
        });
}

function processEnums(enums: Enum[], fileCode: CodeBlock) {
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

function addGeneralComments(fileCode: CodeBlock) {
    fileCode.add(
        "/* eslint-disable @typescript-eslint/no-unused-vars,max-len,@typescript-eslint/no-redeclare,no-trailing-spaces,no-multiple-empty-lines,@typescript-eslint/indent,@typescript-eslint/naming-convention,no-underscore-dangle,vars-on-top,no-var */",
        "// noinspection JSUnusedGlobalSymbols",
    );
}

function addPredefinedTypes(fileCode: CodeBlock) {
    fileCode.scope(`declare type ${INTEGER_TYPE_NAME} = number;`, false);
    fileCode.scope(`declare type ${OPTIONAL_TYPE_NAME}<T> = T | undefined;`, false);
}

function addGlobals(fileCode: CodeBlock) {
    fileCode
        .addAsSection("declare const script: CoreObject;")
        .comment(c => c.add("Provides access to current instance of script."))
        .addAsSection("declare function time(this: void): number;")
        .comment(c => c.add("Returns the time in seconds (floating point) since the game started on the server."))
        .addAsSection("declare function print(this: void, message: string): string;")
        .comment(c => c.add("Print a message to the event log. Access the Event Log from the Window menu."))
        .addAsSection("declare function warn(this: void, message: string): string;")
        .comment(c => c.add("Similar to print(), but includes the script name and line number."));
}

async function processCoreApi({ Classes, Namespaces, Enums }: CoreAPI) {
    const fileCode = new CodeBlock();

    addGeneralComments(fileCode);
    addPredefinedTypes(fileCode);
    addGlobals(fileCode);

    processClasses(Classes, fileCode);
    processNamespaces(Namespaces, fileCode);
    processEnums(Enums, fileCode);

    return fileCode;
}

const programArguments = yargs(process.argv.slice(2))
    .usage("Usage: core-api-gen --output /path/to/generated-file.d.ts")
    .options({
        output: {
            type: "string",
            default: "./generated/core-api-definitions.d.ts",
            normalize: true,
            coerce: (outputPath: string) => {
                const parentFolder = path.dirname(outputPath);
                const stat = fs.statSync(parentFolder);
                if (!stat.isDirectory()) throw new Error(`${parentFolder} in specified path is not a directory`);

                const requiredExtension = ".d.ts";
                if (!outputPath.endsWith(requiredExtension)) {
                    const currentExtension = path.extname(outputPath);
                    if (!currentExtension) {
                        return outputPath + requiredExtension;
                    }

                    return outputPath.substring(0, outputPath.lastIndexOf(currentExtension)) + requiredExtension;
                }
            }
        }
    })
    .parseSync();

loadApiDefinitions()
    .then(processCoreApi)
    .then(result => fs.writeFileSync(programArguments.output!, result.toString()))
    .then(() => console.log("Done!"))
    .catch(e => console.error("Failed with an error:", e));
