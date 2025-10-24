import { DiceAddressCodec } from "@xkore/dice";
import { Codec } from "bufferfy";
import { NodeIdCodec } from "../Keys/Codec";

export const TargetCodec = Codec.Object({
	nodeId: NodeIdCodec,
	diceAddress: DiceAddressCodec,
});

export interface Target extends Codec.Type<typeof TargetCodec> {}
