import {Namespace} from "./core-api-declarations";
import {CodeBlock} from "./code-block";
import {tag} from "./api-types";
import {buildTypedEvent, buildTypedHook} from "./fields-processor";
import {processFunctions} from "./functions-processor";

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

export function processNamespaces(namespaces: Namespace[], fileCode: CodeBlock) {
    namespaces
        .map(n => tag(n, "namespace"))
        .forEach(namespace => {
            const namespaceBlock = fileCode
                .scope(`declare namespace ${namespace.Name} {`)
                .addDescriptionAndDeprecationFor(namespace);

            processNamespaceMembers(namespaceBlock, namespace);
        });
}