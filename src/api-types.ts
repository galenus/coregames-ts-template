import {Class, Enum, Event, Function, Hook, Namespace, Property} from "./core-api-declarations";

type Tagged<T, Tags> = T & { tag: Tags };
export type Context = Namespace | Class | Enum | Function | Event | Property | Hook;
export type ContextTypeTags = "namespace" | "class" | "enum" | "function" | "event" | "property" | "hook";
type TaggedContext = Tagged<Context, ContextTypeTags>;

export function tag<T extends Context, Tag extends ContextTypeTags>(def: T, tag: Tag): Tagged<T, Tag> {
    return {...def, tag};
}

export function getTag(def: Context) {
    return (def as TaggedContext).tag;
}

function isTaggedWith(def: Context, tag: ContextTypeTags): boolean {
    return getTag(def) === tag;
}

const isNamespace = (def: Context): def is Namespace => isTaggedWith(def, "namespace");
const isClass = (def: Context): def is Class => isTaggedWith(def, "class");
const isEnum = (def: Context): def is Enum => isTaggedWith(def, "enum");
const isFunction = (def: Context): def is Function => isTaggedWith(def, "function");
const isEvent = (def: Context): def is Event => isTaggedWith(def, "event");
const isProperty = (def: Context): def is Property => isTaggedWith(def, "property");
const isHook = (def: Context): def is Hook => isTaggedWith(def, "hook");