export interface CoreAPI {
    Classes:    Class[];
    Namespaces: Namespace[];
    Enums:      Enum[];
}

export interface Class {
    Name:             string;
    Description:      string;
    BaseType?:        string;
    Properties:       Property[];
    MemberFunctions:  Function[];
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
    Signatures:  Signature[];
}

export enum Name {
    New = "New",
}

export interface DescribableDeprecatable {
    Description?:        string;
    IsDeprecated?:       boolean;
    DeprecationMessage?: string;
}

export interface Hook extends DescribableDeprecatable {
    Name?:        string;
    Returns?:     Parameter[];
    Parameters?:  Parameter[];
    Tags?:        Tag[];
    Signatures?:  Signature[];
}

export interface Parameter {
    Type?:       string;
    Name?:       string;
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

export interface Property extends DescribableDeprecatable {
    Name:                string;
    Type:                string;
    Tags?:               Tag[];
}

export interface Event extends DescribableDeprecatable {
    Name:                string;
    Parameters?:         Parameter[];
}

export interface Function extends DescribableDeprecatable {
    Name:                string;
    // Parameters?:         Parameter[];
    // Returns?:            Parameter[];
    Signatures:         Signature[];
    Tags?:               Tag[];
}

export interface Signature extends DescribableDeprecatable {
    Returns:             Parameter[];
    Parameters:          Parameter[];
    Name?:               string;
}

export interface Enum {
    Name:        string;
    Description: string;
    Values:      EnumValue[];
}

export interface EnumValue extends DescribableDeprecatable {
    Name:                string;
    Value:               number;
}

export interface Namespace {
    Name:            string;
    Description:     string;
    StaticFunctions: Hook[];
    StaticHooks?:    Hook[];
    StaticEvents?:   Event[];
}
