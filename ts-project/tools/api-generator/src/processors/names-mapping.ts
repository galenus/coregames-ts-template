import { Parameter } from "./core-api-declarations";

export default function getName(p: Parameter) {
    if (p.Name === "function") return "func";

    return p.Name?.replace(/ /g, "_");
}
