import IDGen from "flake-idgen";

const idFormat = require("biguint-format");

const SERIALIZATION_VERSION = 95;

export enum PlatformAssetType {
    script = 3,
}

interface AssetData {
    name: string;
}

const idGen = new IDGen();

function generateAssetId(): string {
    const idBytes = idGen.next();
    return idFormat(idBytes);
}

export default function createAssetDefinition(type: PlatformAssetType, data: AssetData) {
    const { name } = data;
    // eslint-disable-next-line default-case
    switch (type) {
        case PlatformAssetType.script:
            return `Assets {
  Id: ${generateAssetId()}
  Name: "${name}"
  PlatformAssetType: ${type}
  TextAsset {
  }
  SerializationVersion: ${SERIALIZATION_VERSION}
}
`;
    }

    return "";
}
