import {
    Class, Enum, Event, Function, Hook, Namespace, Property,
} from "./core-api-declarations";

type Tagged<T, Tags> = T & { tag: Tags };
export type Context = Namespace | Class | Enum | Function | Event | Property | Hook;
export type ContextTypeTags = "namespace" | "class" | "enum" | "function" | "event" | "property" | "hook";
type TaggedContext = Tagged<Context, ContextTypeTags>;

export function withTag<T extends Context, Tag extends ContextTypeTags>(def: T, tag: Tag): Tagged<T, Tag> {
    return { ...def, tag };
}

export function getTag(def: Context) {
    return (def as TaggedContext).tag;
}

export function isTaggedWith(def: Context, tag: ContextTypeTags): boolean {
    return getTag(def) === tag;
}
