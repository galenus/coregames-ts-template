import {Event, Hook} from "./core-api-declarations";
import {Context} from "./api-types";
import {buildSignature} from "./callables-processor";

export const EVENT_TYPE_NAME = "Event";

export function buildTypedEvent(event: Event, parentDef: Context) {
    return `${event.Name}: ${EVENT_TYPE_NAME}<${buildSignature(event, [parentDef, event], {
        isStatic: true,
        isLambdaSignature: true
    })}>`;
}

export const HOOK_TYPE_NAME = "Hook";

export function buildTypedHook(hook: Hook, parentDef: Context) {
    return `${hook.Name}: ${HOOK_TYPE_NAME}<${buildSignature(hook, [parentDef, hook], {
        isStatic: true,
        isLambdaSignature: true
    })}>`;
}
