import generateObjectId from "./id-generation";
import CodeWriter from "../code-writer";

type TypedObject<Name extends string, T> = { typeName: Name } & (T extends object ? T : { value: T });

abstract class TreeNodeChild<Name extends string, T> {
    protected constructor(
        private readonly name: Name,
        private readonly value?: T,
    ) {
    }

    write(codeWrite: CodeWriter) {
        if ()
    }
}

type Location = TypedObject<"Location", {
    x?: number;
    y?: number;
    z?: number;
}>;

type Rotation = TypedObject<"Rotation", {
    pitch?: number;
    yaw?: number;
    roll?: number;
}>;

const DEFAULT_ROTATION: Rotation = {
    typeName: "Rotation", pitch: 0, yaw: 0, roll: 0,
};

type Scale = TypedObject<"Scale", {
    x: number | 1;
    y: number | 1;
    z: number | 1;
}>;

const DEFAULT_SCALE: Scale = {
    typeName: "Scale", x: 1, y: 1, z: 1,
};

type Transform = TypedObject<"Transform", {
    location: Location;
    rotation: Rotation;
    scale: Scale;
}>;

const DEFAULT_TRANSFORM: Transform = {
    typeName: "Transform",
    location: { typeName: "Location" },
    rotation: { typeName: "Rotation" },
    scale: { ...DEFAULT_SCALE },
};

type PropertyType = "Int" | "Float" | "Bool" | "String" | "Color" | "AssetReference" | "Rotation";

function typed<Name extends string, T>(typeName: Name, templateValue: T): TypedObject<Name, T> {
    return {
        typeName,
        ...(typeof templateValue === "object" ? templateValue : { value: templateValue }),
    } as TypedObject<Name, T>;
}

const TypeTemplates = {
    Int: typed("Int", 0),
    Float: typed("Float", 0),
    Bool: typed("Bool", false),
    String: typed("String", ""),
    Color: typed("Color", {
        color: {
            r: 0, g: 0, b: 0, a: 0,
        },
    }),
    AssetReference: typed("AssetReference", { id: "0" }),
    Rotation: DEFAULT_ROTATION,
};

type TemplateType<K extends keyof typeof TypeTemplates> = typeof TypeTemplates[K];

abstract class Property<T extends PropertyType> {
    protected constructor(
        private readonly name: string,
        private readonly namePrefix: string,
        private readonly value: TemplateType<T>,
    ) {
    }
}

class BuiltInProperty<T extends PropertyType = "String"> extends Property<T> {
    constructor(name: string, value: TemplateType<T>) {
        super(name, "pb:", value);
    }
}

class CustomProperty<T extends PropertyType = "String"> extends Property<T> {
    constructor(name: string, value: TemplateType<T>) {
        super(name, "cs:", value);
    }
}

type StringValue = TypedObject<"Value", string>;

interface ScriptAsset {
    id: string;
}

interface TreeNode {
    id: string;
    name: string;
    parentId?: string;
    transform: TypedObject<"Transform", Transform>;
    children?: TreeNode[];
    unregisteredParameters?: Property<any>[];
    collidable?: StringValue;
    visible?: StringValue;
    cameraCollidable?: StringValue;
    editorIndicatorVisibility?: StringValue;
    script?: ScriptAsset;
}

const DEFAULT_COLLIDABLE: StringValue = { typeName: "Value", value: "mc:ecollisionsetting:inheritfromparent" };
const DEFAULT_VISIBLE: StringValue = { typeName: "Value", value: "mc:evisibilitysetting:inheritfromparent" };
const DEFAULT_CAMERA_COLLIDABLE: StringValue = { typeName: "Value", value: "mc:ecollisionsetting:inheritfromparent" };
const DEFAULT_EDITOR_INDICATOR_VISIBILITY: StringValue = { typeName: "Value", value: "mc:eindicatorvisibility:visiblewhenselected" };

function writeObjectProperties<Name extends string, T extends TypedObject<Name, unknown>>(obj: T) {
    const { typeName, write, value } = obj as any;
    const objectEntries =
}
function writeTransform(transform: TypedObject<"Transform", Transform>, indent: string) {
    return `Transform {
${Obje}
}`;
}

class TreeNodeImpl implements TreeNode {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly collidable: Value,
        public readonly visible: Value,
        public readonly cameraCollidable: Value,
        public readonly editorIndicatorVisibility: Value,
        public readonly transform: Transform,
        public readonly parentId?: string,
        public readonly children?: TreeNode[],
        public readonly unregisteredParameters?: Property<any>[],
        public readonly script?: ScriptAsset,
    ) {
    }

    serialize(target: string[]) {
        const contents: string[] = [];
        const thisContents = `
Objects {
  Id: ${this.id}
  Name: "${this.name}"
  ${writeTransform(this.transform, "  ")}
}`;
    }
}
