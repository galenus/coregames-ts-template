import { Context, ContextTypeTags, getTag } from "./api-types";

export const OBJECT_CLASS_NAME = "Object";
export const INTEGER_TYPE_NAME = "Integer";
const CORE_API_OBJECT_CLASS_NAME = "__CoreAPI__Object";

interface MapTypeResult {
    mappedType: string;
    genericDefinition?: true | {
        base?: string;
    }
}

type TypeUsage = "typeName" | "return" | "arg" | "memberType";

interface TypeContext {
    typeUsage: TypeUsage;
    typedItemKey?: string | number;
    parentDefinitionsStack: Context[];
}

type RootTags = Extract<ContextTypeTags, "class" | "namespace" | "enum">;
type MemberTags = Exclude<ContextTypeTags, RootTags>;
type TypesByItemKey = Record<string | number, string | MapTypeResult>;
type TypesByUsage = Partial<Record<TypeUsage, TypesByItemKey>>;
type TypesByMemberName = Record<string, TypesByUsage>;
type TypesByMemberTag = Partial<Record<MemberTags, TypesByMemberName>>;
type TypesByRootName = Record<string, TypesByMemberTag>;
type TypesByRootTag = Partial<Record<RootTags, TypesByRootName>>;

const specialTypes: TypesByRootTag = {
    namespace: {
        Chat: {
            hook: {
                receiveMessageHook: {
                    arg: {
                        parameters: "{ message: string, speakerName: string }",
                    },
                },
                sendMessageHook: {
                    arg: {
                        parameters: "{ message: string }",
                    },
                },
            },
            function: {
                BroadcastMessage: {
                    arg: {
                        optionalParams: "{ players: Player | Array<Player> }",
                    },
                },
                LocalMessage: {
                    arg: {
                        optionalParams: "{ players: Player | Array<Player> }",
                    },
                },
            },
        },
        CoreDebug: {
            function: {
                DrawLine: {
                    arg: {
                        parameters: "{ duration?: number, thickness?: number, color?: Color }",
                    },
                },
                DrawBox: {
                    arg: {
                        parameters: "{ duration?: number, thickness?: number, color?: Color, rotation: Rotation }",
                    },
                },
                DrawSphere: {
                    arg: {
                        parameters: "{ duration?: number, thickness?: number, color?: Color }",
                    },
                },
            },
        },
        CoreString: {
            function: {
                Split: {
                    arg: {
                        optionalParameters: "{ removeEmptyResults?: boolean, maxResults?: number, delimiters?: string | Array<string> }",
                    },
                },
            },
        },
        Game: {
            function: {
                GetPlayers: {
                    arg: {
                        optionalParams: "{ ignoreDead?: boolean, ignoreLiving?: boolean, ignoreSpawned?: boolean, ignoreDespawned?: boolean, ignoreTeams?: number | Array<number>, includeTeams?: number | Array<number>, ignorePlayers?: Player | Array<Player> }",
                    },
                },
                FindPlayersInCylinder: {
                    arg: {
                        optionalParams: "{ ignoreDead?: boolean, ignoreLiving?: boolean, ignoreSpawned?: boolean, ignoreDespawned?: boolean, ignoreTeams?: number | Array<number>, includeTeams?: number | Array<number>, ignorePlayers?: Player | Array<Player> }",
                    },
                },
                FindPlayersInSphere: {
                    arg: {
                        optionalParams: "{ ignoreDead?: boolean, ignoreLiving?: boolean, ignoreSpawned?: boolean, ignoreDespawned?: boolean, ignoreTeams?: number | Array<number>, includeTeams?: number | Array<number>, ignorePlayers?: Player | Array<Player> }",
                    },
                },
                FindNearestPlayer: {
                    arg: {
                        optionalParameters: "{ ignoreDead?: boolean, ignoreLiving?: boolean, ignoreSpawned?: boolean, ignoreDespawned?: boolean, ignoreTeams?: number | Array<number>, includeTeams?: number | Array<number>, ignorePlayers?: Player | Array<Player> }",
                    },
                },
            },
        },
        UI: {
            function: {
                ShowFlyUpText: {
                    arg: {
                        optionalParameters: "{ duration?: number, color?: Color, font?: string, isBig?: boolean }",
                    },
                },
            },
        },
        World: {
            function: {
                SpawnAsset: {
                    arg: {
                        optionalParameters: "{ parent?: CoreObject, position?: Vector3, rotation?: Rotation | Quaternion, scale?: Vector3 }",
                    },
                },
                Raycast: {
                    arg: {
                        optionalParameters: "{ ignoreTeams?: number | Array<number>, ignorePlayers?: Player | Array<Player> | boolean }",
                    },
                },
            },
        },
    },
    class: {
        AIActivityHandler: {
            function: {
                AddActivity: {
                    arg: {
                        functions: "{ tick?: (this: AIActivity, deltaTime: number) => void, tickHighestPriority?: (this: AIActivity, deltaTime: number) => void, start?: (this: AIActivity) => void, stop?: (this: AIActivity) => void }",
                    },
                },
            },
        },
        AnimatedMesh: {
            function: {
                PlayAnimation: {
                    arg: {
                        optionalParameters: "{ startPosition?: number, playbackRate?: number, shouldLoop?: boolean }",
                    },
                },
            },
        },
        CurveKey: {
            function: {
                New: {
                    arg: {
                        optionalParameters: "{ interpolation?: CurveInterpolation, arriveTangent?: number, leaveTangent?: number, tangent?: number }",
                    },
                },
            },
        },
        Player: {
            hook: {
                movementHook: {
                    arg: {
                        parameters: "{ direction: Vector3 }",
                    },
                },
            },
            function: {
                Spawn: {
                    arg: {
                        optionalParameters: "{ position?: Vector3, rotation?: Rotation, scale?: Vector3, spawnKey?: string }",
                    },
                },
                GetPrivateNetworkedDataKeys: {
                    return: {
                        0: "Array<string>",
                    },
                },
            },
        },
        CoreObject: {
            function: {
                GetCustomProperty: {
                    return: {
                        0: {
                            mappedType: "",
                            genericDefinition: {
                                base: "(number | boolean | string | Vector2 | Vector3 | Vector4 | Rotation | Color | CoreObjectReference | NetReference)",
                            },
                        },
                    },
                },
            },
        },
        SimpleCurve: {
            function: {
                New: {
                    arg: {
                        keys: "Array<CurveKey>",
                        optionalParameters: "{ preExtrapolation?: CurveExtrapolation, postExtrapolation?: CurveExtrapolation, defaultValue?: number }",
                    },
                },
            },
        },
        Vehicle: {
            hook: {
                clientMovementHook: {
                    arg: {
                        parameters: "{ throttleInput: number, steeringInput: number, isHandbrakeEngaged: boolean }",
                    },
                },
                serverMovementHook: {
                    arg: {
                        parameters: "{ throttleInput: number, steeringInput: number, isHandbrakeEngaged: boolean }",
                    },
                },
            },
        },
        Vfx: {
            function: {
                Play: {
                    arg: {
                        optionalParameters: "{ includeDescendants: boolean }",
                    },
                },
                Stop: {
                    arg: {
                        optionalParameters: "{ includeDescendants: boolean }",
                    },
                },
            },
        },
    },
};

function handleSpecialType(type: string, {
    parentDefinitionsStack,
    typeUsage,
    typedItemKey,
}: TypeContext): MapTypeResult | false {
    if (parentDefinitionsStack.length < 2 || parentDefinitionsStack.find(subj => !subj)) return false;

    const [root, member] = parentDefinitionsStack;
    const mappedType = specialTypes[getTag(root) as RootTags]
        ?.[root.Name ?? ""]
        ?.[getTag(member) as MemberTags]
        ?.[member.Name ?? ""]
        ?.[typeUsage]
        ?.[typedItemKey ?? ""];

    if (!mappedType) return false;

    return typeof mappedType === "string" ? { mappedType } : mappedType;
}

export function mapType(type: string, context?: TypeContext): MapTypeResult {
    const specialTypeHandlingResult = context && handleSpecialType(type, context);
    if (specialTypeHandlingResult) return specialTypeHandlingResult;

    switch (type) {
        case "integer":
            return { mappedType: INTEGER_TYPE_NAME };
        case "function":
            return { mappedType: "(...args: any[]) => void" };
        case "table":
            return { mappedType: "Record<string, any>", genericDefinition: { base: "Record<string, any>" } };
        case "value":
            return { mappedType: "any", genericDefinition: true };
        case OBJECT_CLASS_NAME:
            return { mappedType: CORE_API_OBJECT_CLASS_NAME };
        case "":
            return { mappedType: "any" };
        case undefined:
            return { mappedType: "any" };
        default:
            return { mappedType: type };
    }
}
