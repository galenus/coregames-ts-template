import IDGen from "flake-idgen";

const idFormat = require("biguint-format");

const idGen = new IDGen();

export default function generateObjectId(): string {
    const idBytes = idGen.next();
    return idFormat(idBytes);
}
