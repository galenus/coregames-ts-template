import fs from "fs";
import axios from "axios";
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
    Enum,
} from "./core-api-declarations";

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

function mapType(type?: string): MapTypeResult {
    switch (type) {
        case "integer": return { mappedType: INTEGER_TYPE_NAME };
        case "function": return { mappedType: "(...args: any[]) => void" };
        case "table": return { mappedType: "Record<string, any>" };
        case undefined: return { mappedType: "any" };
        case "value": return { mappedType: "any", isGeneric: true };
        case OBJECT_CLASS_NAME: return { mappedType: CORE_API_OBJECT_CLASS_NAME };
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
    options?: SignatureOptions,
) {
    const { isStatic, isLambdaSignature } = options ?? {};

    const parameterDefs = Parameters?.map(p => {
        const { mappedType } = mapType(p.Type);
        return `${p.IsVariadic ? "..." : ""}${(getName(p))}${p.IsOptional ? "?" : ""}: ${mappedType}${p.IsVariadic ? "[]" : ""}`;
    });

    const returnDefs: string[] = [];
    const genericParams: string[] = [];
    let genericParamsCount = 0;
    for (let index = 0; index < (Returns?.length ?? 0); index++) {
        const ret = Returns![index];
        // eslint-disable-next-line prefer-const
        let { mappedType, isGeneric } = mapType(ret.Type);
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
    ownerName: string,
    declarationPrefix: string,
) {
    if (func.Name === IS_A_FUNCTION && ownerName === OBJECT_CLASS_NAME) {
        functionsSection
            .section()
            .add(`${func.Name}<T extends ${mapType(OBJECT_CLASS_NAME).mappedType}>(): this is T;`);
    }
}

function processFunctions(
    functions: Function[],
    functionsSection: CodeBlock,
    staticFunctions: boolean,
    ownerName: string,
    declarationPrefix = "",
) {
    functions.forEach(func => {
        if (SPECIAL_FUNCTION_NAMES.includes(func.Name)) {
            handleSpecialFunction(func, functionsSection, staticFunctions, ownerName, declarationPrefix);
            return;
        }

        func.Signatures.forEach(signature => {
            functionsSection
                .section()
                .addDefinitionLine(
                    `${declarationPrefix}${func.Name}${buildSignature(signature, { isStatic: staticFunctions })};`,
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
function buildTypedEvent(event: Event) {
    return `${event.Name}: ${EVENT_TYPE_NAME}<${buildSignature(event, { isStatic: true, isLambdaSignature: true })}>`;
}

const HOOK_TYPE_NAME = "Hook";
function buildTypedHook(hook: Hook) {
    return `${hook.Name}: ${HOOK_TYPE_NAME}<${buildSignature(hook, { isStatic: true, isLambdaSignature: true })}>`;
}

function processClassMembers(classBlock: CodeBlock, currentClass: Class, fileCode: CodeBlock) {
    classBlock.section("PROPERTIES", true)
        .addDefinitionLines(
            currentClass.Properties,
            prop => {
                const { mappedType } = mapType(prop.Type);
                return `${prop.Tags?.includes(Tag.ReadOnly) ? "readonly " : ""}${prop.Name}: ${mappedType};`;
            },
        );

    classBlock.section("EVENTS", true)
        .addDefinitionLines(
            currentClass.Events ?? [],
            event => `readonly ${buildTypedEvent(event)};`,
        );

    classBlock.section("HOOKS", true)
        .addDefinitionLines(
            currentClass.Hooks ?? [],
            hook => `readonly ${buildTypedHook(hook)};`,
        );

    processFunctions(
        currentClass.MemberFunctions,
        classBlock.section("INSTANCE METHODS", true),
        false,
        currentClass.Name,
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
        const mappedClassName: string = mapType(currentClass.Name).mappedType;

        const staticTypeName = declarationOverrides?.staticTypeName ?? `${mappedClassName}Static`;
        const staticInstanceDeclaration = declarationOverrides?.staticInstanceDeclaration
            ?? `declare const ${mappedClassName}: ${staticTypeName};`;

        const staticClassBlock = fileCode.scope(`declare interface ${staticTypeName} {`);

        staticClassBlock.section("CONSTANTS", true)
            .addDefinitionLines(
                currentClass.Constants ?? [],
                constant => `readonly ${constant.Name}: ${mapType(constant.Type).mappedType};`,
            );

        processFunctions(
            currentClass.Constructors ?? [],
            staticClassBlock.section("CONSTRUCTORS", true),
            true,
            currentClass.Name,
        );
        processFunctions(
            currentClass.StaticFunctions ?? [],
            staticClassBlock.section("STATIC METHODS", true),
            true,
            currentClass.Name,
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

    const classBlock = fileCode
        .scope(`declare interface ${mapType(OBJECT_CLASS_NAME).mappedType} {`)
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
    classes.forEach(currentClass => {
        if (handleClassIfSpecial(currentClass, fileCode)) return;

        const classExtendsClause = currentClass.BaseType
            ? ` extends ${mapType(currentClass.BaseType).mappedType}`
            : "";
        const classBlock = fileCode
            .scope(`declare interface ${mapType(currentClass.Name).mappedType}${classExtendsClause} {`)
            .addDescriptionAndDeprecationFor(currentClass);

        processClassMembers(classBlock, currentClass, fileCode);
        processClassStatics(currentClass, fileCode);
    });
}

function processNamespaceMembers(namespaceBlock: CodeBlock, namespace: Namespace) {
    namespaceBlock.section("EVENTS")
        .addDefinitionLines(
            namespace.StaticEvents ?? [],
            event => `export const ${buildTypedEvent(event)};`,
        );

    namespaceBlock.section("HOOKS")
        .addDefinitionLines(
            namespace.StaticHooks ?? [],
            hook => `export const ${buildTypedHook(hook)};`,
        );

    processFunctions(
        namespace.StaticFunctions,
        namespaceBlock.section("FUNCTIONS"),
        true,
        namespace.Name,
        "export function ",
    );
}

function processNamespaces(namespaces: Namespace[], fileCode: CodeBlock) {
    namespaces.forEach(namespace => {
        const namespaceBlock = fileCode
            .scope(`declare namespace ${namespace.Name} {`)
            .addDescriptionAndDeprecationFor(namespace);

        processNamespaceMembers(namespaceBlock, namespace);
    });
}

function processEnums(enums: Enum[], fileCode: CodeBlock) {
    enums.forEach(enumDef => fileCode.scope(`declare enum ${mapType(enumDef.Name).mappedType} {`)
        .addDescriptionAndDeprecationFor(enumDef)
        .add(
            ...enumDef.Values.map(({ Name, Value }) => `${Name} = ${Value},`),
        ));
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

loadApiDefinitions()
    .then(processCoreApi)
    .then(result => fs.writeFileSync("./generated/core-api-definitions.d.ts", result.toString()))
    .then(() => console.log("Done!"))
    .catch(e => console.error("Failed with an error:", e));
