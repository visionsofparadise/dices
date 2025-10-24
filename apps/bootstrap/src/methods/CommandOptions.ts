import { RequiredProperties } from "@xkore/dice";

export type CommandOptions<RequiredKey extends string, OptionalKey extends string> = RequiredProperties<Record<RequiredKey | OptionalKey, string>, RequiredKey>;
