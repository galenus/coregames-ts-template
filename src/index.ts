import axios from "axios";
import { CoreAPI, Class, Name } from "./core-api-declarations";


const API_DEFINITIONS_URL = "https://raw.githubusercontent.com/ManticoreGamesInc/platform-documentation/development/src/assets/api/CoreLuaAPI.json";

async function loadApiDefinitions(): Promise<CoreAPI> {
    const response = await axios.get(API_DEFINITIONS_URL);
    return response.data as CoreAPI;
}

function retrieveNextItem<T>(items: Record<string, T>, itemNames: string[], name?: string): T | false {
    let currentName = name ?? itemNames.pop();
    if (!currentName) return false;

    while (!items[currentName]) {
        currentName = itemNames.pop();
        if (!currentName) return false;
    }

    return items[currentName];
}

const TAB = "    ";
const OBJECT_CLASS_NAME = "Object";
const FIRST_COMMENT_LINE = "/**";

class CodeBlock {
    private readonly code: (string | CodeBlock)[] = [];

    constructor(
        private readonly prefix: string = "",
        private readonly firstLine?: string,
        private readonly lastLine?: string,
    ) {
        if (!!firstLine) this.code.push(firstLine);
    }

    add(...codeLines: string[]) {
        this.code.push(...codeLines.map(l => `${this.prefix}${l}`));
    }

    comment() {
        if (this.code[0] instanceof CodeBlock && this.code[0].firstLine === FIRST_COMMENT_LINE) {
            return this.code[0];
        }

        const commentBlock = new CodeBlock(" * ", FIRST_COMMENT_LINE, " */");
        this.code.unshift(commentBlock);
        return commentBlock;
    }

    type(typeDeclaration: string, lastTypeLine: string = "}") {
        const typeBlock = new CodeBlock(this.prefix + TAB, typeDeclaration, lastTypeLine);
        this.code.push(typeBlock);

        return typeBlock;
    }

    getLines(): string[] {
        return [
            ...this.code.flatMap(code => {
                if (code instanceof CodeBlock) {
                    return code.getLines();
                }

                return code.split("\n").map(line => line.replace(/^\r|\r$/g, ""));
            }),
            ... !!this.lastLine ? [this.lastLine] : [],
        ];
    }

    toString() {
        return this.getLines().join("\n");
    }
}

function processClasses(classes: Record<string, Class>, classNames: string[], fileCode: CodeBlock = new CodeBlock()) {
    let currentClass: Class | false;
    while (!!(currentClass = retrieveNextItem(classes, classNames))) {
        const classExtendsClause = currentClass.BaseType && currentClass.BaseType !== OBJECT_CLASS_NAME
            ? ` extends ${currentClass.BaseType}`
            : "";
        const classBlock = fileCode.type(`declare interface ${currentClass.Name}${classExtendsClause} {`)

        if (!!currentClass.Description) {
            classBlock.comment().add(currentClass.Description);
        }
    }

    return fileCode;
}

async function processCoreApi({Classes, Namespaces, Enums}: CoreAPI) {
    const {classes, classNames} = Classes.reduce(
        ({ classes, classNames }, clazz) => ({
            classes: {...classes, [clazz.Name]: clazz },
            classNames: [...classNames, clazz.Name ]
        }),
        {classes: {} as Record<string, Class>, classNames: [] as string[]}
    );
    const fileCode = processClasses(classes, classNames);

    return fileCode;
}

loadApiDefinitions()
    .then(processCoreApi)
    .then(result => console.log("Done!\n", result.toString()))
    .catch(e => console.error("Failed with an error:", e));