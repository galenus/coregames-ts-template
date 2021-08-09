import { Namespace } from "./core-api-declarations";
import CodeWriter from "./code-writer";
import { withTag } from "./api-types";
import { buildTypedEvent, buildTypedHook } from "./fields-processor";
import processFunctions from "./functions-processor";
import { ApiGenerationOptions } from "./types";

export default function processNamespaces(
    namespaces: Namespace[],
    fileCode: CodeWriter,
    options: ApiGenerationOptions,
) {
    function processNamespaceMembers(namespaceBlock: CodeWriter, namespace: Namespace) {
        namespaceBlock.section("EVENTS")
            .addDefinitionLines(
                (namespace.StaticEvents ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(e => withTag(e, "event")),
                event => `export const ${buildTypedEvent(event, namespace)};`,
            );

        namespaceBlock.section("HOOKS")
            .addDefinitionLines(
                (namespace.StaticHooks ?? [])
                    .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                    .map(h => withTag(h, "hook")),
                hook => `export const ${buildTypedHook(hook, namespace)};`,
            );

        processFunctions(
            namespace.StaticFunctions
                .filter(subj => !(options.omitDeprecated && subj.IsDeprecated))
                .map(f => withTag(f, "function")),
            namespaceBlock.section("FUNCTIONS"),
            true,
            namespace,
            "export function ",
        );
    }

    namespaces
        .map(n => withTag(n, "namespace"))
        .forEach(namespace => {
            const namespaceBlock = fileCode
                .scope(`declare namespace ${namespace.Name} {`)
                .addDescriptionAndDeprecationFor(namespace);

            processNamespaceMembers(namespaceBlock, namespace);
        });
}
