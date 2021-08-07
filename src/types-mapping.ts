import {Context, ContextTypeTags, getTag} from "./api-types";

export const OBJECT_CLASS_NAME = "Object";
export const INTEGER_TYPE_NAME = "Integer";
const CORE_API_OBJECT_CLASS_NAME = "__CoreAPI__Object";

interface MapTypeResult {
    mappedType: string;
    isGeneric?: boolean;
}

type TypeUsage = "typeName" | "return" | "arg" | "memberType";

interface TypeContext {
    typeUsage: TypeUsage;
    typedItemName?: string;
    parentDefinitionsStack: Context[];
}

type RootTags = Extract<ContextTypeTags, "class" | "namespace" | "enum">
type MemberTags = Exclude<ContextTypeTags, RootTags>
type TypesByItemName = Record<string, string>
type TypesByUsage = Partial<Record<TypeUsage, TypesByItemName>>
type TypesByMemberName = Record<string, TypesByUsage>
type TypesByMemberTag = Partial<Record<MemberTags, TypesByMemberName>>
type TypesByRootName = Record<string, TypesByMemberTag>
type TypesByRootTag = Partial<Record<RootTags, TypesByRootName>>
const specialTypes: TypesByRootTag = {
    namespace: {
        World: {
            function: {
                SpawnAsset: {
                    arg: {
                        optionalParameters: "{parent?: CoreObject, position?: Vector3, rotation?: Rotation | Quaternion, scale?: Vector3}"
                    }
                }
            }
        }
    },
    class: {
        AIActivityHandler: {
            function: {
                AddActivity: {
                    arg: {
                        functions: "{tick?: (this: AIActivity, deltaTime: number) => void, tickHighestPriority?: (this: AIActivity, deltaTime: number) => void, start?: (this: AIActivity) => void, stop?: (this: AIActivity) => void}"
                    }
                }
            }
        }
    }
};

function handleSpecialType(type: string, {
    parentDefinitionsStack,
    typeUsage,
    typedItemName
}: TypeContext): MapTypeResult | false {
    if (parentDefinitionsStack.length < 2 || parentDefinitionsStack.find(subj => !subj)) return false;

    const [root, member] = parentDefinitionsStack;
    const mappedType = specialTypes[getTag(root) as RootTags]
        ?.[root.Name ?? ""]
        ?.[getTag(member) as MemberTags]
        ?.[member.Name ?? ""]
        ?.[typeUsage]
        ?.[typedItemName ?? ""];

    if (!mappedType) return false;

    return {mappedType};
}

export function mapType(type: string, context?: TypeContext): MapTypeResult {
    const specialTypeHandlingResult = context && handleSpecialType(type, context);
    if (specialTypeHandlingResult) return specialTypeHandlingResult;

    switch (type) {
        case "integer":
            return {mappedType: INTEGER_TYPE_NAME};
        case "function":
            return {mappedType: "(...args: any[]) => void"};
        case "table":
            return {mappedType: "Record<string, any>"};
        case "value":
            return {mappedType: "any", isGeneric: true};
        case OBJECT_CLASS_NAME:
            return {mappedType: CORE_API_OBJECT_CLASS_NAME};
        case "":
            return {mappedType: "any"};
        case undefined:
            return {mappedType: "any"};
        default:
            return {mappedType: type};
    }
}