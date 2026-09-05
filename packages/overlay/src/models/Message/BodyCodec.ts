import { AddressCodec } from "@xkore/dice";
import { Codec } from "bufferfy";
import { NodeIdCodec, SignatureCodec } from "../Keys/Codec";
import { NodeCodec } from "../Node/Codec";
import { TransactionIdCodec } from "../TransactionId/Codec";
import { KeyCodec, ValueCodec } from "../Value/Codec";

export enum MessageBodyType {
	PING,
	FIND_NODE,
	FIND_VALUE,
	SUCCESS_RESPONSE,
	NODES_RESPONSE,
	VALUE_RESPONSE,
}

export const PingBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.PING),
	transactionId: TransactionIdCodec,
	node: NodeCodec,
});

export interface PingBody extends Codec.Type<typeof PingBodyCodec> {}

export const FindNodeBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.FIND_NODE),
	transactionId: TransactionIdCodec,
	nodeId: NodeIdCodec,
	node: NodeCodec,
});

export interface FindNodeBody extends Codec.Type<typeof FindNodeBodyCodec> {}

export const FindValueBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.FIND_VALUE),
	transactionId: TransactionIdCodec,
	key: KeyCodec,
	node: NodeCodec,
});

export interface FindValueBody extends Codec.Type<typeof FindValueBodyCodec> {}

export const SuccessResponseBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.SUCCESS_RESPONSE),
	transactionId: TransactionIdCodec,
	reflectionAddress: AddressCodec,
	node: NodeCodec,
	signature: SignatureCodec,
});

export interface SuccessResponseBody extends Codec.Type<typeof SuccessResponseBodyCodec> {}

export const NodesResponseBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.NODES_RESPONSE),
	transactionId: TransactionIdCodec,
	nodes: Codec.Array(NodeCodec, Codec.UInt(8)),
	reflectionAddress: AddressCodec,
	node: NodeCodec,
	signature: SignatureCodec,
});

export interface NodesResponseBody extends Codec.Type<typeof NodesResponseBodyCodec> {}

export const ValueResponseBodyCodec = Codec.Object({
	type: Codec.Constant(MessageBodyType.VALUE_RESPONSE),
	transactionId: TransactionIdCodec,
	value: ValueCodec,
	reflectionAddress: AddressCodec,
	node: NodeCodec,
	signature: SignatureCodec,
});

export interface ValueResponseBody extends Codec.Type<typeof ValueResponseBodyCodec> {}

export const MessageBodyCodec = Codec.Union([PingBodyCodec, FindNodeBodyCodec, FindValueBodyCodec, SuccessResponseBodyCodec, NodesResponseBodyCodec, ValueResponseBodyCodec]);

export type MessageBody = Codec.Type<typeof MessageBodyCodec>;

export type MessageBodyMap = {
	[T in MessageBody["type"]]: Extract<MessageBody, { type: T }>;
};
