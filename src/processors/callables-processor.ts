import {Signature} from "./core-api-declarations";
import {Context} from "./api-types";
import {mapType} from "./types-mapping";
import {getName} from "./names-mapping";

export const OPTIONAL_TYPE_NAME = "Optional";
const MULTI_RETURN_TYPE_NAME = "LuaMultiReturn";
type Callable = Partial<Pick<Signature, "Parameters" | "Returns">>;

interface SignatureOptions {
    isStatic?: boolean;
    isLambdaSignature?: boolean;
}

export function buildSignature(
    {Parameters, Returns}: Callable,
    context: Context[],
    options?: SignatureOptions,
) {
    const {isStatic, isLambdaSignature} = options ?? {};

    const parameterDefs = Parameters?.map(p => {
        const {mappedType} = mapType(p.Type ?? "", {
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
        let {mappedType, isGeneric} = mapType(ret.Type ?? "", {
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