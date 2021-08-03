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
    Enum
} from "./core-api-declarations";

const API_DEFINITIONS_URL = "https://raw.githubusercontent.com/ManticoreGamesInc/platform-documentation/development/src/assets/api/CoreLuaAPI.json";

async function loadApiDefinitions(): Promise<CoreAPI> {
    const response = await axios.get(API_DEFINITIONS_URL);
    return response.data as CoreAPI;
}

const TAB = "    ";
const OBJECT_CLASS_NAME = "Object";
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
        if (!!firstLine) this.code.push(firstLine);
    }

    add(...codeLines: (string | false)[]) {
        this.code.push(...codeLines.filter(item => !!item).map(l => l + ""));
        return this;
    }

    comment() {
        if (this.code[0] instanceof CodeBlock && this.code[0].firstLine === FIRST_COMMENT_LINE) {
            return this.code[0];
        }

        const commentBlock = new CodeBlock(" * ", FIRST_COMMENT_LINE, " */");
        this.code.unshift(commentBlock);
        return commentBlock;
    }

    section(name?: string, wrapWithNewLines = false) {
        const section = new CodeBlock("", name && `// ${name}` || undefined, undefined, wrapWithNewLines, true);
        this.code.push(section);
        return section;
    }

    scope(scopeDeclarationFirstLine: string, lastScopeLine: string | false = "}") {
        const scopeBlock = new CodeBlock(TAB, scopeDeclarationFirstLine, lastScopeLine || undefined, true);
        this.code.push(scopeBlock);

        return scopeBlock;
    }

    addDescriptionAndDeprecationFor({ Description, DeprecationMessage, IsDeprecated }: DescribableDeprecatable) {
        if (!Description && !IsDeprecated) return this;

        this.comment()
            .add(Description ?? false)
            .add(IsDeprecated ? `@deprecated ${DeprecationMessage ?? ""}` : false);

        return this;
    }

    addDefinitionLine(declarationLine: string, definition: DescribableDeprecatable) {
        this.section()
            .add(declarationLine)
            .addDescriptionAndDeprecationFor(definition);

        return this;
    }

    addDefinitionLines<T extends DescribableDeprecatable>(definitions: T[], toDeclarationLine: (def: T) => string) {
        for (const definition of definitions) {
            this.addDefinitionLine(toDeclarationLine(definition), definition);
        }

        return this;
    }

    getCodeLines(): string[] {
        if (this.removeEmpty && this.code.length === 1 && this.code[0] === this.firstLine) {
            return [];
        }

        return [
            ...!!this.wrapWithNewLines ? [""]: [],
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
            ...!!this.lastLine ? [this.lastLine] : [],
            ...!!this.wrapWithNewLines ? [""]: []
        ];
    }

    toString() {
        return this.getCodeLines().join("\n");
    }
}

const INTEGER_TYPE_NAME = "Integer";
const OPTIONAL_TYPE_NAME = "Optional";
const MULTI_RETURN_TYPE_NAME = "LuaMultiReturn";

function mapType(type?: string): string {
    switch (type) {
        case "integer": return INTEGER_TYPE_NAME;
        case "function": return "(...args: any[]) => void";
        case "table": return "Record<string, any>";
        case undefined: return "any";
    }

    return type;
}

type Callable = Partial<Pick<Signature, "Parameters" | "Returns">>;

function getName(p: Parameter) {
    if (p.Name === "function") return "func";

    return p.Name?.replace(/ /g, "_");
}

function buildSignature({ Parameters, Returns }: Callable, isLambda = false) {
    const parameterDefs = Parameters?.map(p => `${p.IsVariadic ? "..." : ""}${(getName(p))}${p.IsOptional ? "?" : ""}: ${mapType(p.Type)}${p.IsVariadic ? "[]" : ""}`);
    const returnDefs = Returns?.map(r => `${r.IsOptional ? OPTIONAL_TYPE_NAME + "<" : ""}${mapType(r.Type)}${r.IsOptional ? ">" : ""}${r.IsVariadic ? "[]": ""}`);

    const invocation = `(${parameterDefs?.join(", ") ?? ""})`;

    let returnType;
    if (!returnDefs?.length) {
        returnType = "void";
    } else if (returnDefs.length === 1) {
        returnType = returnDefs[0];
    } else {
        returnType = `${MULTI_RETURN_TYPE_NAME}<[${returnDefs.join(", ")}]>`;
    }

    return `${invocation}${isLambda ? " => " : ": "}${returnType}`;
}

function processFunctions(functions: Function[], functionsSection: CodeBlock, declarationPrefix = "") {
    for (const func of functions) {
        for (const signature of func.Signatures) {
            functionsSection
                .section()
                .addDefinitionLine(
                    `${declarationPrefix}${func.Name}${buildSignature(signature)};`,
                    {
                        Description: signature.Description ?? func.Description,
                        IsDeprecated: signature.IsDeprecated ?? func.IsDeprecated,
                        DeprecationMessage: signature.DeprecationMessage ?? func.DeprecationMessage
                    }
                );
        }
    }
}

const EVENT_TYPE_NAME = "Event";
function buildTypedEvent(event: Event) {
    return `${event.Name}: ${EVENT_TYPE_NAME}<${buildSignature(event, true)}>`;
}

const HOOK_TYPE_NAME = "Hook";
function buildTypedHook(hook: Hook) {
    return `${hook.Name}: ${HOOK_TYPE_NAME}<${buildSignature(hook, true)}>`;
}

function processClassMembers(classBlock: CodeBlock, currentClass: Class, fileCode: CodeBlock) {
    classBlock.section("PROPERTIES", true)
        .addDefinitionLines(
            currentClass.Properties,
            prop => `${prop.Tags?.includes(Tag.ReadOnly) ? "readonly " : ""}${prop.Name}: ${mapType(prop.Type)};`
        );

    classBlock.section("EVENTS", true)
        .addDefinitionLines(
            currentClass.Events ?? [],
            event => `readonly ${buildTypedEvent(event)};`
        );

    classBlock.section("HOOKS", true)
        .addDefinitionLines(
            currentClass.Hooks ?? [],
            hook => `readonly ${buildTypedHook(hook)};`
        )

    processFunctions(currentClass.MemberFunctions, classBlock.section("INSTANCE METHODS", true));

    if (!!currentClass.Constructors || !!currentClass.Constants || !!currentClass.StaticFunctions) {
        const staticTypeName = `${currentClass.Name}Static`;
        const staticClassBlock = fileCode.scope(`declare interface ${staticTypeName} {`);

        staticClassBlock.section("CONSTANTS", true)
            .addDefinitionLines(
                currentClass.Constants ?? [],
                constant => `readonly ${constant.Name}: ${mapType(constant.Type)};`
            );

        processFunctions(currentClass.Constructors ?? [], staticClassBlock.section("CONSTRUCTORS", true));
        processFunctions(currentClass.StaticFunctions ?? [], staticClassBlock.section("STATIC METHODS", true));

        fileCode.add(`declare const ${currentClass.Name}: ${staticTypeName};`);
    }
}

const CONNECT_FUNC_NAME = "Connect";
const HANDLER_TYPE_NAME = "THandler";

function processClassIfSpecial(type: Class, fileCode: CodeBlock): boolean {
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
                        ...connectFuncParams.slice(connectFuncHandlerParamIndex + 1)
                    ]
                }]
            },
            ...type.MemberFunctions.filter(f => f.Name !== CONNECT_FUNC_NAME)
        ]
    };

    const classBlock = fileCode
        .scope(`declare interface ${type.Name}<${HANDLER_TYPE_NAME}> {`)
        .addDescriptionAndDeprecationFor(type);

    processClassMembers(classBlock, updatedClass, fileCode);

    return true;
}

function processClasses(classes: Class[], fileCode: CodeBlock) {
    for (const currentClass of classes) {
        if (processClassIfSpecial(currentClass, fileCode)) continue;

        const classExtendsClause = currentClass.BaseType && currentClass.BaseType !== OBJECT_CLASS_NAME
            ? ` extends ${currentClass.BaseType}`
            : "";
        const classBlock = fileCode
            .scope(`declare interface ${currentClass.Name}${classExtendsClause} {`)
            .addDescriptionAndDeprecationFor(currentClass);

        processClassMembers(classBlock, currentClass, fileCode);
    }
}

function processNamespaceMembers(namespaceBlock: CodeBlock, namespace: Namespace) {
    namespaceBlock.section("EVENTS")
        .addDefinitionLines(
            namespace.StaticEvents ?? [],
            event => `export const ${buildTypedEvent(event)};`
        );

    namespaceBlock.section("HOOKS")
        .addDefinitionLines(
            namespace.StaticHooks ?? [],
            hook => `export const ${buildTypedHook(hook)};`
        );

    processFunctions(
        namespace.StaticFunctions,
        namespaceBlock.section("FUNCTIONS"),
        "export function "
    );
}

function processNamespaces(namespaces: Namespace[], fileCode: CodeBlock) {
    for (const namespace of namespaces) {
        const namespaceBlock = fileCode
            .scope(`declare namespace ${namespace.Name} {`)
            .addDescriptionAndDeprecationFor(namespace);

        processNamespaceMembers(namespaceBlock, namespace);
    }
}

function processEnums(enums: Enum[], fileCode: CodeBlock) {
    for (const enumDef of enums) {
        fileCode.scope(`declare enum ${enumDef.Name} {`)
            .addDescriptionAndDeprecationFor(enumDef)
            .add(
                ...enumDef.Values.map(({Name, Value}) => `${Name} = ${Value},`)
            );
    }
}

function addPredefinedTypes(fileCode: CodeBlock) {
    fileCode.scope(`declare type ${INTEGER_TYPE_NAME} = number;`, false);
    fileCode.scope(`declare type ${MULTI_RETURN_TYPE_NAME}<T extends Array> = {};`, false);
    fileCode.scope(`declare type ${OPTIONAL_TYPE_NAME}<T> = T | undefined;`, false);
}

async function processCoreApi({Classes, Namespaces, Enums}: CoreAPI) {
    let fileCode = new CodeBlock();
    addPredefinedTypes(fileCode);
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