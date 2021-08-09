import { Signature } from "./core-api-declarations";
import { Context } from "./api-types";
import { mapType } from "./types-mapping";
import getName from "./names-mapping";

export const OPTIONAL_TYPE_NAME = "Optional";
const MULTI_RETURN_TYPE_NAME = "LuaMultiReturn";
type Callable = Partial<Pick<Signature, "Parameters" | "Returns">>;

interface SignatureOptions {
    isStatic?: boolean;
    isLambdaSignature?: boolean;
}

const AVAILABLE_GENERIC_PARAM_TYPES = ["T", "U", "V", "W", "X", "Y", "Z", "A", "B", "C"];
export function buildSignature(
    { Parameters, Returns }: Callable,
    context: Context[],
    options?: SignatureOptions,
) {
    const { isStatic, isLambdaSignature } = options ?? {};

    const parameterDefs = Parameters?.map(p => {
        const { mappedType } = mapType(p.Type ?? "", {
            parentDefinitionsStack: context,
            typedItemKey: p.Name,
            typeUsage: "arg",
        });
        return `${p.IsVariadic ? "..." : ""}${(getName(p))}${p.IsOptional ? "?" : ""}: ${mappedType}${p.IsVariadic ? "[]" : ""}`;
    });

    const returnDefs: string[] = [];
    const genericParams: string[] = [];
    let genericParamsIndex = 0;
    for (let index = 0; index < (Returns?.length ?? 0); index++) {
        const ret = Returns![index];
        // eslint-disable-next-line prefer-const
        let { mappedType, genericDefinition } = mapType(ret.Type ?? "", {
            typeUsage: "return",
            parentDefinitionsStack: context,
            typedItemKey: index,
        });

        if (genericDefinition) {
            const extendsClause = typeof genericDefinition !== "boolean" ? ` extends ${genericDefinition.base}` : "";
            const defaultType = mappedType !== "" ? ` = ${mappedType}` : "";
            mappedType = AVAILABLE_GENERIC_PARAM_TYPES[genericParamsIndex];
            genericParams.push(`${mappedType}${extendsClause}${defaultType}`);
            genericParamsIndex++;
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
