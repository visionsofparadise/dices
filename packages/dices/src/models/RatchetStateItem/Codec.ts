import { Codec } from "bufferfy";
import { RatchetStateItem } from ".";
import { HashCodec } from "../../utilities/Hash";
import { KeyIdCodec } from "../RatchetKeysItem/KeyIdCodec";
import { RootChainCodec } from "../RootChain/Codec";
import { MessageSecretCodec } from "./SecretCodec";

const SkippedKeyEntryCodec = Codec.Object({
	messageNumber: Codec.VarInt(60),
	secret: MessageSecretCodec,
	createdAt: Codec.VarInt(60),
});

const SkippedKeysCodec = Codec.Array(SkippedKeyEntryCodec);

export const RatchetStateItemKeyCodec = Codec.Object({
	indexKey: Codec.Bytes(Uint8Array.from([0x01])),
	ratchetId: HashCodec,
});

export type RatchetStateItemKey = Codec.Type<typeof RatchetStateItemKeyCodec>;

export const RatchetStateItemValueCodec = Codec.Object({
	remoteKeyId: Codec.Optional(KeyIdCodec),
	rootChain: RootChainCodec,
	previousChainLength: Codec.VarInt(60),
	skippedKeys: SkippedKeysCodec,
	ratchetAt: Codec.VarInt(60),
});

export type RatchetStateItemValue = Codec.Type<typeof RatchetStateItemValueCodec>;

export const RatchetStateItemCodec = Codec.Transform(
	Codec.Object({
		key: RatchetStateItemKeyCodec,
		value: RatchetStateItemValueCodec,
	}),
	{
		decode: ({ key, value }) =>
			new RatchetStateItem({
				...key,
				...value,
			}),
		encode: (ratchetState) => ({
			key: ratchetState,
			value: ratchetState,
		}),
	}
);
