// eslint-disable-next-line max-classes-per-file
import generateObjectId from "./id-generation";
import CodeWriter from "../code-writer";
import { Maybe, Nullable } from "../types";

const NESTED_NODES_INDENT = "  ";

class TreeWriter extends CodeWriter {
    constructor(
        firstLine?: string,
        lastLine?: string,
    ) {
        super(NESTED_NODES_INDENT, firstLine, lastLine, "", false, false);
    }

    protected createNew(
        nestedIndent?: string,
        firstLine?: string,
        lastLine?: string,
    ): this {
        return new TreeWriter(firstLine, lastLine) as this;
    }

    protected sectionName(): string | undefined {
        return "";
    }
}

const ORDERED_NODE_NAMES = {
    __UNKNOWN__: -1,
    Id: 0,
    Name: 1,
    RootId: 2,
    Transform: 20,
    ParentId: 30,
    Objects: 40,
    ChildIds: 40,
    UnregisteredParameters: 50,
    Collidable_v2: 60,
    Visible_v2: 70,
    CameraCollidable: 80,
    EditorIndicatorVisibility: 90,
    Folder: 1000,
    NetworkContext: 1100,
    Script: 1200,
    ScriptAsset: 1210,
    Location: 2010,
    X: 2011,
    Y: 2012,
    Z: 2013,
    Rotation: 2020,
    Pitch: 2021,
    Yaw: 2022,
    Roll: 2023,
    Scale: 2030,
    Overrides: 5000,
    String: 5100,
    Float: 5100,
    Int: 5100,
    Bool: 5100,
    AssetReference: 5100,
    Color: 5200,
    R: 5201,
    G: 5202,
    B: 5203,
    A: 5204,
    IsGroup: 1010,
    IsFilePartition: 1010,
    FilePartitionName: 1020,
    Value: 2000,
};

type NodeName = keyof typeof ORDERED_NODE_NAMES;

function isNodeName(value?: string): value is NodeName {
    return typeof value === "string" && !!(ORDERED_NODE_NAMES as any)[value];
}

type SimpleNodeValue = string | number | boolean | unknown;
type NestedNodeValue = TreeNode<NodeName> | Maybe<TreeNode<NodeName>>[] | unknown;
type NodeValue = SimpleNodeValue | NestedNodeValue;

interface TreeNode<Name extends NodeName, T extends NodeValue = unknown> {
    name: Name;
    value?: T;
}

abstract class TreeNodeImpl<Name extends NodeName, T extends NodeValue = unknown> implements TreeNode<Name, T> {
    constructor(
        readonly name: Name,
        readonly value?: T,
    ) {
    }

    abstract write(scopeWriter: CodeWriter, rootLevelWriter: CodeWriter): void;

    get order() {
        return ORDERED_NODE_NAMES[this.name];
    }
}

class UnknownNode extends TreeNodeImpl<"__UNKNOWN__"> {
    constructor(public readonly unknownName: string, value: string[]) {
        super("__UNKNOWN__", value);
    }

    write(scopeWriter: CodeWriter, rootLevelWriter: CodeWriter): void {
        scopeWriter.add(...this.value as string[]);
    }
}

interface SimpleNode<Name extends NodeName, T extends SimpleNodeValue> extends TreeNode<Name, T> {
}

class SimpleNodeImpl<Name extends NodeName, T extends SimpleNodeValue>
    extends TreeNodeImpl<Name, T>
    implements SimpleNode<Name, T> {
    write(scopeWriter: CodeWriter) {
        if (!this.value) return;

        scopeWriter.add(`${this.name}: "${this.value}"`);
    }
}

function simpleNode<Name extends NodeName, T extends SimpleNodeValue>(
    name: Name,
    value?: T,
): SimpleNodeImpl<Name, T> | undefined {
    return value ? new SimpleNodeImpl<Name, T>(name, value) : undefined;
}

interface ContainerNode<Name extends NodeName, T extends NestedNodeValue> extends TreeNode<Name, T> {
}

class ContainerNodeImpl<Name extends NodeName, T extends NestedNodeValue>
    extends TreeNodeImpl<Name, T>
    implements ContainerNode<Name, T> {
    write(scopeWriter: CodeWriter, rootLevelWriter: CodeWriter): void {
        this.writeContainerNode(scopeWriter, rootLevelWriter);
    }

    protected writeContainerNode(scopeWriter: CodeWriter, rootLevelWriter: CodeWriter) {
        const scope = scopeWriter.scope(`${this.name} {`);
        if (Array.isArray(this.value)) {
            (this.value as Maybe<TreeNodeImpl<NodeName>>[])
                .filter(node => typeof node !== "undefined" && node !== null)
                .sort((first, second) => first!.order - second!.order)
                .forEach(node => node!.write(scope, rootLevelWriter));
        } else if (this.value instanceof TreeNodeImpl) {
            this.value.write(scope, rootLevelWriter);
        }

        return scope;
    }
}

function containerNode<Name extends NodeName, T extends Maybe<TreeNodeImpl<NodeName>>[]>(name: Name, ...value: T) {
    return new ContainerNodeImpl<Name, T>(name, value);
}

type RootLevelNodeDef = RootLevelNode<Maybe<TreeNodeImpl<NodeName>>[]>;
type RootLevelNodeChildren = RootLevelNodeDef[];

abstract class RootLevelNode<T extends Maybe<TreeNodeImpl<NodeName>>[]> extends ContainerNodeImpl<"Objects", T> {
    protected constructor(
        readonly id: string,
        readonly children: RootLevelNodeChildren,
        value: T,
        parentId?: string,
    ) {
        super("Objects", value ?? []);
        this.value!.unshift(simpleNode("Id", id));
        if (parentId) {
            this.value!.push(simpleNode("ParentId", parentId));
        }
    }

    write(scopeWriter: CodeWriter, rootLevelWriter: CodeWriter) {
        scopeWriter.add(`ChildIds: ${this.id}`);
        const thisNodeScope = super.writeContainerNode(rootLevelWriter, rootLevelWriter);
        this.children.forEach(node => node.write(thisNodeScope, rootLevelWriter));
    }
}

type Coordinates = [
    Maybe<SimpleNodeImpl<"X", number>>,
    Maybe<SimpleNodeImpl<"Y", number>>,
    Maybe<SimpleNodeImpl<"Z", number>>,
];

class CoordinatesNode<Name extends NodeName> extends ContainerNodeImpl<Name, Coordinates> {
    constructor(name: Name, x?: number, y?: number, z?: number) {
        super(name, [
            simpleNode("X", x),
            simpleNode("Y", y),
            simpleNode("Z", z),
        ]);
    }
}

class Location extends CoordinatesNode<"Location"> {
    constructor(x?: number, y?: number, z?: number) {
        super("Location", x, y, z);
    }
}

class Scale extends CoordinatesNode<"Scale"> {
    constructor(x: number, y: number, z: number) {
        super("Scale", x, y, z);
    }
}

class Rotation extends ContainerNodeImpl<"Rotation", [
    Maybe<SimpleNodeImpl<"Pitch", number>>,
    Maybe<SimpleNodeImpl<"Yaw", number>>,
    Maybe<SimpleNodeImpl<"Roll", number>>,
]> {
    constructor(pitch?: number, yaw?: number, roll?: number) {
        super("Rotation", [
            simpleNode("Pitch", pitch),
            simpleNode("Yaw", yaw),
            simpleNode("Roll", roll),
        ]);
    }
}

class Transform extends ContainerNodeImpl<"Transform", [
    Location,
    Rotation,
    Scale,
]> {
    constructor(value: [Location, Rotation, Scale]) {
        super("Transform", value);
    }
}

const DEFAULT_LOCATION = new Location();
const DEFAULT_ROTATION = new Rotation();
const DEFAULT_SCALE = new Scale(1, 1, 1);

const DEFAULT_TRANSFORM = new Transform([DEFAULT_LOCATION, DEFAULT_ROTATION, DEFAULT_SCALE]);

class Color extends ContainerNodeImpl<"Color", [
    Maybe<SimpleNodeImpl<"R", number>>,
    Maybe<SimpleNodeImpl<"G", number>>,
    Maybe<SimpleNodeImpl<"B", number>>,
    Maybe<SimpleNodeImpl<"A", number>>,
]> {
    constructor(r?: number, g?: number, b?: number, a?: number) {
        super("Color", [
            simpleNode("R", r),
            simpleNode("G", g),
            simpleNode("B", b),
            simpleNode("A", a),
        ]);
    }
}

class AssetReference extends ContainerNodeImpl<"AssetReference", SimpleNodeImpl<"Id", string>> {
    constructor(id: string) {
        super("AssetReference", simpleNode("Id", id));
    }
}

class StringNode<Name extends NodeName> extends SimpleNodeImpl<Name, string> {
    constructor(name: Name, value: string) {
        super(name, StringNode.addQuotesToString(value));
    }

    private static addQuotesToString(value: string) {
        // eslint-disable-next-line @typescript-eslint/quotes
        let updatedValue = value.startsWith('"') ? value : `"${value}`;
        // eslint-disable-next-line @typescript-eslint/quotes
        updatedValue = updatedValue.endsWith('"') ? updatedValue : `${updatedValue}"`;
        return updatedValue;
    }
}

function stringNode<Name extends NodeName>(name: Name, value?: string): Maybe<StringNode<Name>> {
    return typeof value === "string" ? new StringNode<Name>(name, value) : undefined;
}

type PropertyValue =
    | SimpleNodeImpl<"Int" | "Float", number>
    | StringNode<"String">
    | SimpleNodeImpl<"Bool", boolean>
    | Color
    | AssetReference
    | Rotation;
type PropertyNamePrefix = "pb:" | "cs:";

abstract class Property<T extends PropertyValue> extends ContainerNodeImpl<"Overrides", [
    SimpleNodeImpl<"Name", string>,
    PropertyValue,
]> {
    protected constructor(namePrefix: PropertyNamePrefix, propertyName: string, value: T) {
        super("Overrides", [
            simpleNode("Name", `"${namePrefix}${propertyName}"`)!,
            value,
        ]);
    }
}

class BuiltInProperty<T extends PropertyValue> extends Property<T> {
    constructor(propertyName: string, value: T) {
        super("pb:", propertyName, value);
    }
}

class CustomProperty<T extends PropertyValue> extends Property<T> {
    constructor(propertyName: string, value: T) {
        super("cs:", propertyName, value);
    }
}

class Properties extends ContainerNodeImpl<"UnregisteredParameters", BuiltInProperty<PropertyValue>[] | CustomProperty<PropertyValue>[]> {
    constructor(value: BuiltInProperty<PropertyValue>[] | CustomProperty<PropertyValue>[]) {
        super("UnregisteredParameters", value);
    }
}

const DEFAULT_PROPERTIES = new Properties([]);

const DEFAULT_COLLIDABLE = new ContainerNodeImpl("Collidable_v2", stringNode("Value", "mc:ecollisionsetting:inheritfromparent"));
const DEFAULT_VISIBLE = new ContainerNodeImpl("Visible_v2", stringNode("Value", "mc:evisibilitysetting:inheritfromparent"));
const DEFAULT_CAMERA_COLLIDABLE = new ContainerNodeImpl("CameraCollidable", stringNode("Value", "mc:ecollisionsetting:inheritfromparent"));
const DEFAULT_EDITOR_INDICATOR_VISIBILITY = new ContainerNodeImpl("EditorIndicatorVisibility", stringNode("Value", "mc:eindicatorvisibility:visiblewhenselected"));

type Collidable = typeof DEFAULT_COLLIDABLE;
type Visible = typeof DEFAULT_VISIBLE;
type CameraCollidable = typeof DEFAULT_CAMERA_COLLIDABLE;
type EditorIndicatorVisibility = typeof DEFAULT_EDITOR_INDICATOR_VISIBILITY;

interface RootLevelNodeParams {
    id: string;
    name: string;
    parentId?: string;
    transform?: Transform;
    properties?: Properties;
    collidable?: Collidable;
    visible?: Visible;
    cameraCollidable?: CameraCollidable;
    editorIndicatorVisibility?: EditorIndicatorVisibility;
    children?: RootLevelNodeChildren;
    additionalNested?: Maybe<TreeNodeImpl<NodeName>>[]
}

class GenericRootLevelNode extends RootLevelNode<Maybe<TreeNodeImpl<NodeName>>[]> {
    constructor({
        id,
        name,
        parentId,
        transform,
        properties,
        collidable,
        visible,
        cameraCollidable,
        editorIndicatorVisibility,
        children,
        additionalNested,
    }: RootLevelNodeParams) {
        super(
            id,
            children ?? [],
            [
                stringNode("Name", name),
                transform ?? DEFAULT_TRANSFORM,
                properties ?? DEFAULT_PROPERTIES,
                collidable ?? DEFAULT_COLLIDABLE,
                visible ?? DEFAULT_VISIBLE,
                cameraCollidable ?? DEFAULT_CAMERA_COLLIDABLE,
                editorIndicatorVisibility,
                ...(additionalNested || []),
            ],
            parentId,
        );
    }

    addChild(childNode: GenericRootLevelNode) {
        this.children.push(childNode);
    }
}

class Script extends GenericRootLevelNode {
    constructor(scriptId: number, nodeParams: RootLevelNodeParams) {
        super({
            ...nodeParams,
            editorIndicatorVisibility: nodeParams.editorIndicatorVisibility ?? DEFAULT_EDITOR_INDICATOR_VISIBILITY,
            additionalNested: [
                ...(nodeParams.additionalNested || []),
                containerNode("Script", containerNode("ScriptAsset", simpleNode("Id", scriptId))),
            ],
        });
    }
}

class Folder extends GenericRootLevelNode {
    constructor(nodeParams: RootLevelNodeParams) {
        super({
            ...nodeParams,
            editorIndicatorVisibility: nodeParams.editorIndicatorVisibility ?? DEFAULT_EDITOR_INDICATOR_VISIBILITY,
            additionalNested: [
                ...(nodeParams.additionalNested || []),
                containerNode("Folder",
                    simpleNode("IsFilePartition", true),
                    stringNode("FilePartitionName", nodeParams.name)),
            ],
        });
    }
}

const ROOT_NODE_NAME = "Root";

class TreeRoot extends GenericRootLevelNode {
    constructor(id: string) {
        super({
            id,
            name: ROOT_NODE_NAME,
            additionalNested: [
                containerNode("Folder"),
            ],
        });
    }

    write(rootLevelWriter: CodeWriter) {
        rootLevelWriter.add(
            `Name: "${ROOT_NODE_NAME}"`,
            `RootId: ${this.id}`,
        );
        super.write(rootLevelWriter, rootLevelWriter);
    }
}

class RootLevelNodeBuilder {
    private readonly params: Partial<RootLevelNodeParams> = {};

    constructor(
        params: Partial<RootLevelNodeParams>,
        private readonly factory: (nodeParams: RootLevelNodeParams) => GenericRootLevelNode,
        readonly existingNode?: RootLevelNodeDef,
    ) {
        this.params = params;
    }

    static from(node: RootLevelNodeDef): RootLevelNodeBuilder {
        const params: RootLevelNodeParams = node.value!.reduce(
            (aggr, currentNode) => {
                switch (currentNode?.name) {
                    case "Id":
                        return { ...aggr, id: currentNode.value as string };
                    case "Name":
                        return { ...aggr, name: currentNode.value as string };
                    case "ParentId":
                        return { ...aggr, parentId: currentNode.value as string };
                    case "Transform":
                        return { ...aggr, transform: currentNode as Transform };
                    case "UnregisteredParameters":
                        return { ...aggr, properties: currentNode as Properties };
                    case "Collidable_v2":
                        return { ...aggr, collidable: currentNode as Collidable };
                    case "Visible_v2":
                        return { ...aggr, visible: currentNode as Visible };
                    case "CameraCollidable":
                        return { ...aggr, cameraCollidable: currentNode as CameraCollidable };
                    case "EditorIndicatorVisibility":
                        return { ...aggr, editorIndicatorVisibility: currentNode as EditorIndicatorVisibility };
                    default:
                        if (currentNode) {
                            return {
                                ...aggr,
                                additionalNested: [
                                    ...(aggr.additionalNested || []),
                                    currentNode,
                                ],
                            };
                        }

                        return aggr;
                }
            },
            {} as RootLevelNodeParams,
        );

        params.children = node.children;

        return new RootLevelNodeBuilder(params, p => new GenericRootLevelNode(p), node);
    }
}

type BuilderCallback = (folderBuilder: RootLevelNodeBuilder) => RootLevelNodeBuilder;

// eslint-disable-next-line import/prefer-default-export
export class TreeBuilder {
    private readonly builders: RootLevelNodeBuilder[] = [];

    constructor(private readonly root: TreeRoot) {
        this.builders = root.children.map(RootLevelNodeBuilder.from);
    }

    static from(root: TreeRoot): TreeBuilder {
        return new TreeBuilder(root);
    }

    static new(): TreeBuilder {
        return new TreeBuilder(new TreeRoot(generateObjectId()));
    }

    update(selector: (node: RootLevelNodeDef) => boolean, configure: BuilderCallback): boolean {
        const builderIndex = this.builders.filter(b => b.existingNode).findIndex(b => selector(b.existingNode!));
        if (builderIndex < 0) return false;

        this.builders[builderIndex] = configure(this.builders[builderIndex]);
        return true;
    }

    withFolder(folderName: string, configure: BuilderCallback): TreeBuilder {
        const folderBuilder = configure(
            new RootLevelNodeBuilder({
                id: generateObjectId(),
                parentId: this.root.id,
            },
            params => new Folder(params)),
        );
        this.builders.push(folderBuilder);
        return this;
    }
}

export function serializeTree(tree: TreeRoot) {
    const rootLevelWriter = new TreeWriter();
    tree.write(rootLevelWriter);
    return rootLevelWriter.toString();
}

function getUnindentedLine(currentLine: string, indentationLevel: number) {
    return currentLine
        .substr(indentationLevel * NESTED_NODES_INDENT.length);
}

const simpleNodeNameGroup = "simpleNodeName";
const numericValueGroup = "numericValue";
const stringValueGroup = "stringValue";

interface SimpleNodeMatch {
    groups?: {
        [simpleNodeNameGroup]: string | undefined;
        [numericValueGroup]: string | undefined;
        [stringValueGroup]: string | undefined;
    }
}
const simpleNodePattern = new RegExp(`\\s*(?<${simpleNodeNameGroup}>\\w+):\\s((?<${numericValueGroup}>-?\\d+(\\.\\d+)?)|(?<${stringValueGroup}>"\\w+([:\\s]+\\w+)*"))$`);

function parseSimpleNode(currentLine: string, indentationLevel: number): Maybe<TreeNode<NodeName>> | false {
    const simpleNodeMatch = getUnindentedLine(currentLine, indentationLevel)
        .match(simpleNodePattern) as Nullable<SimpleNodeMatch>;
    const simpleNodeName = simpleNodeMatch?.groups?.simpleNodeName;

    if (typeof simpleNodeName !== "string") return false;

    if (isNodeName(simpleNodeName)) {
        const numericValue = simpleNodeMatch?.groups?.numericValue;
        if (numericValue) {
            return simpleNode(simpleNodeName, numericValue + 0);
        }

        const stringValue = simpleNodeMatch?.groups?.stringValue;
        if (typeof stringValue === "string") {
            return stringNode(simpleNodeName, stringValue);
        }
    }

    return new UnknownNode(simpleNodeName,[currentLine]);
}

const containerNodeNameGroup = "containerNodeName";
const containerNodeFirstLinePattern = new RegExp(`^(?<${containerNodeNameGroup}>\\w+)\\s{$`);
const containerNodeLastLinePattern = new RegExp("^}$");
interface ContainerNodeMatch {
    groups?: {
        [containerNodeNameGroup]: string | undefined;
    }
}

function iterateOverContainerNodeLines(
    nodesTextIterator: Iterator<string>,
    indentationLevel: number,
    lineCallback: (unindentedLine: string) => void,
) {
    let current = nodesTextIterator.next();
    while (!current.done) {
        const unindentedLine = getUnindentedLine(current.value, indentationLevel);
        if (containerNodeLastLinePattern.test(unindentedLine)) break;

        lineCallback(unindentedLine);

        current = nodesTextIterator.next();
    }
}

function parseRootLevelNode(nodesTextIterator: Iterator<string>) {
    return undefined;
}

function parseKnownContainerNode(
    containerName: NodeName,
    nodesTextIterator: Iterator<string>,
    indentationLevel: number,
): ContainerNode<NodeName> {
    switch (containerName) {
        case "Objects":
            return parseRootLevelNode(nodesTextIterator);
    }
}

function parseContainerNode(currentLine: string, nodesTextIterator: Iterator<string>, indentationLevel: number): TreeNode<NodeName> | false {
    const containerNodeMatch = getUnindentedLine(currentLine, indentationLevel)
        .match(containerNodeFirstLinePattern) as Nullable<ContainerNodeMatch>;
    const containerName = containerNodeMatch?.groups?.containerNodeName;

    if (typeof containerName !== "string") return false;

    if (!isNodeName(containerName)) {
        const unknownNodeLines: string[] = [];
        iterateOverContainerNodeLines(nodesTextIterator, indentationLevel, unknownNodeLines.push);
        return new UnknownNode(containerName, unknownNodeLines);
    }

    return parseKnownContainerNode(containerName, nodesTextIterator, indentationLevel);
}

// export function parseTree(treeText: Iterable<string>) {
//     const nodesTextIterator = treeText[Symbol.iterator]();
//     let current = nodesTextIterator.next();
//     while (!current.done) {
//         const { value } = current;
//         if (value.length > 0) {
//
//                 parseContainerNode(containerName, nodesTextIterator);
//             }
//         }
//
//         current = nodesTextIterator.next();
//     }
// }
