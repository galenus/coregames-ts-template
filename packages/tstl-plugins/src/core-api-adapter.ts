/* eslint-disable import/no-extraneous-dependencies */
import * as tstl from "typescript-to-lua";
import {
    CallExpression,
    CompilerOptions,
    EmitHost,
    FunctionDefinition,
    FunctionExpression,
    isIdentifier,
    LuaLibImportKind,
    LuaPrinter,
    PrintResult,
    TransformationContext,
} from "typescript-to-lua";
import * as ts from "typescript";

const SCRIPTS_ROOT_VAR_NAME = "__SCRIPTS_ROOT";
const REQUIRE_KEYWORD = "require";
const NO_SELF_ARG_FUNCTION_NAMES = ["Tick"];

function buildRequiredModuleGetter(requiredModule: string) {
    return `${SCRIPTS_ROOT_VAR_NAME}:GetCustomProperty("${requiredModule}")`;
}

function patchGetCompilerOptions(program: ts.Program) {
    const originalFunc = program.getCompilerOptions;
    const patchedProgram = program;
    patchedProgram.getCompilerOptions = () => {
        const options = originalFunc.call(program);
        const patchedOptions: CompilerOptions = {
            ...options,
            noHeader: true,
            luaLibImport: LuaLibImportKind.None,
            sourceMapTraceback: false,
        };

        return patchedOptions;
    };

    return patchedProgram;
}

function addScriptsRootIfNecessary(file: tstl.File, libRootName: string) {
    if (file.luaLibFeatures.size === 0
        && file.statements.findIndex(
            st => tstl.isVariableDeclarationStatement(st)
                && !!st.right?.[0]
                && tstl.isCallExpression(st.right?.[0])
                && tstl.isIdentifier(st.right[0].expression)
                && st.right[0].expression.text === REQUIRE_KEYWORD,
        ) < 0
    ) return;

    // eslint-disable-next-line no-param-reassign
    file.trivia += `local ${SCRIPTS_ROOT_VAR_NAME} = World.FindObjectByName("${libRootName}")\n`;
}

const LUA_LIB_VAR = "__LUA_LIB";

function addLuaLibRequireIfNecessary(file: tstl.File) {
    if (file.luaLibFeatures.size === 0) return;

    let { trivia: updatedTrivia } = file;
    updatedTrivia += `local ${LUA_LIB_VAR} = require(${buildRequiredModuleGetter("lualib_bundle")})\n`;
    file.luaLibFeatures.forEach(luaLibFeature => {
        updatedTrivia += `local __TS__${luaLibFeature} = ${LUA_LIB_VAR}.__TS__${luaLibFeature}\n`;
    });

    // eslint-disable-next-line no-param-reassign
    file.trivia = updatedTrivia;
}

class AdapterPrinter extends LuaPrinter {
    constructor(private readonly libRootName: string, emitHost: EmitHost, program: ts.Program, fileName: string) {
        super(emitHost, patchGetCompilerOptions(program), fileName);
    }

    public print(file: tstl.File) {
        addScriptsRootIfNecessary(file, this.libRootName);
        addLuaLibRequireIfNecessary(file);

        const sourceNode = this.concatNodes(file.trivia, ...this.printStatementArray(file.statements));

        return {
            code: sourceNode.toString(),
            sourceMap: undefined,
            sourceMapNode: undefined,
        } as unknown as PrintResult;
    }

    public printCallExpression(expression: CallExpression): any {
        const result = super.printCallExpression(expression);

        if (isIdentifier(expression.expression) && expression.expression.text === "require") {
            const replacementIndex = result.children.findIndex(node => node.toString() === "(") + 1;
            const nodeToReplace = result.children[replacementIndex];

            const originalContent = nodeToReplace.children[0].toString();
            const lastSlashIndex = originalContent.lastIndexOf("/");
            const moduleNameStartIndex = lastSlashIndex < 0 ? 0 : lastSlashIndex + 1;
            let lastQuoteIndex = originalContent.lastIndexOf("\"");
            if (lastQuoteIndex < 0) {
                lastQuoteIndex = originalContent.lastIndexOf("'");
            }
            const moduleNameEndIndex = lastQuoteIndex < 0 ? originalContent.length : lastQuoteIndex;
            const adaptedModuleName = originalContent.substring(moduleNameStartIndex, moduleNameEndIndex) as any;

            nodeToReplace.children = [
                buildRequiredModuleGetter(adaptedModuleName) as any,
            ];
        }

        return result;
    }

    public printFunctionDefinition(statement: FunctionDefinition) {
        let adaptedStatement = statement;
        if (isIdentifier(statement.left[0]) && NO_SELF_ARG_FUNCTION_NAMES.includes(statement.left[0].text)) {
            const functionExpression = statement.right[0] as FunctionExpression;
            const functionParameters = functionExpression.params;
            if (functionParameters?.[0].originalName === "this") {
                const adaptedFunctionExpression: FunctionExpression = {
                    ...functionExpression,
                    params: functionParameters.slice(1),
                };
                adaptedStatement = {
                    ...statement,
                    right: [adaptedFunctionExpression],
                };
            }
        }

        return super.printFunctionDefinition(adaptedStatement);
    }
}

function createAdapterPrinter(libRootName: string) {
    return (
        program: ts.Program,
        emitHost: EmitHost,
        fileName: string,
        file: tstl.File,
    ) => new AdapterPrinter(libRootName, emitHost, program, fileName).print(file);
}

function transformCallExpression(node: ts.CallExpression, context: TransformationContext) {
    let adaptedNode = node;
    const calledName = ts.isPropertyAccessExpression(node.expression) && node.expression.name.escapedText;
    if (calledName && calledName === "IsA"
        && node.arguments.length === 0
        && node.typeArguments?.length === 1
        && ts.isTypeReferenceNode(node.typeArguments[0])
    ) {
        const typeName = ts.isIdentifier(node.typeArguments[0].typeName) && node.typeArguments[0].typeName.escapedText;
        if (typeName) {
            adaptedNode = ts.factory.updateCallExpression(
                node,
                node.expression,
                undefined,
                ts.factory.createNodeArray([
                    ts.factory.createStringLiteral(typeName),
                ]),
            );
        }
    }
    return context.superTransformExpression(adaptedNode);
}

interface PluginArguments {
    libRootName: string;
}

const plugin = ({ libRootName }: PluginArguments) => ({
    visitors: {
        [ts.SyntaxKind.CallExpression]: transformCallExpression,
    },
    printer: createAdapterPrinter(libRootName),
});

export default plugin;
