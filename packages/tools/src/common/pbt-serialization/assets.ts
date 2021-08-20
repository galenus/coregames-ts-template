import generateObjectId from "./id-generation";

const SERIALIZATION_VERSION = 95;

export enum PlatformAssetType {
    script = 3,
}

interface AssetData {
    name: string;
}

export function createAssetDefinition(type: PlatformAssetType, data: AssetData) {
    const { name } = data;
    // eslint-disable-next-line default-case
    switch (type) {
        case PlatformAssetType.script:
            return `Assets {
  Id: ${generateObjectId()}
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
