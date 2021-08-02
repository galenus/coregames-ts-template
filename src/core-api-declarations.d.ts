export interface CoreAPI {
    Classes:    Class[];
    Namespaces: Namespace[];
    Enums:      Enum[];
}

export interface Class {
    Name:             string;
    Description:      string;
    BaseType?:        string;
    Properties:       Event[];
    MemberFunctions:  Event[];
    Events?:          Event[];
    Constructors?:    Constructor[];
    Constants?:       Constant[];
    StaticFunctions?: Hook[];
    Hooks?:           Hook[];
}

export interface Constant {
    Name:        string;
    Description: string;
    Type:        string;
}

export interface Constructor {
    Name:        Name;
    Description: string;
    Signatures:  Hook[];
}

export enum Name {
    New = "New",
}

export interface Hook {
    Returns?:     HookReturn[];
    Parameters?:  HookParameter[];
    Name?:        string;
    Description?: string;
    Tags?:        Tag[];
    Signatures?:  HookSignature[];
}

export interface HookParameter {
    Type: string;
    Name: string;
}

export interface HookReturn {
    Type: string;
}

export interface HookSignature {
    Returns:      PurpleReturn[];
    Parameters:   Parameter[];
    Name?:        string;
    Description?: string;
}

export interface Parameter {
    Type?:       string;
    Name?:       string;
    IsOptional?: boolean;
    IsVariadic?: boolean;
}

export interface PurpleReturn {
    Type?:       string;
    IsOptional?: boolean;
    IsVariadic?: boolean;
}

export enum Tag {
    ClientOnly = "ClientOnly",
    Dynamic = "Dynamic",
    ReadOnly = "ReadOnly",
    RequiresAuthority = "RequiresAuthority",
    ServerOnly = "ServerOnly",
}

export interface Event {
    Name:                string;
    Description?:        string;
    Parameters?:         EventParameter[];
    Tags?:               Tag[];
    IsDeprecated?:       boolean;
    DeprecationMessage?: string;
    Signatures?:         EventSignature[];
    Type?:               string;
}

export interface EventParameter {
    Type:        string;
    Name:        string;
    IsOptional?: boolean;
}

export interface EventSignature {
    Returns:             Parameter[];
    Parameters:          Parameter[];
    Name?:               string;
    Description?:        string;
    IsDeprecated?:       boolean;
    DeprecationMessage?: string;
}

export interface Enum {
    Name:        string;
    Description: string;
    Values:      Value[];
}

export interface Value {
    Name:                string;
    Description?:        string;
    Value:               number;
    IsDeprecated?:       boolean;
    DeprecationMessage?: string;
}

export interface Namespace {
    Name:            string;
    Description:     string;
    StaticFunctions: Hook[];
    StaticHooks?:    Hook[];
    StaticEvents?:   Event[];
}
