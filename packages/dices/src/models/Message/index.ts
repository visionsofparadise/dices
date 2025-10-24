import { RequiredProperties } from "@xkore/dice";
import { MAGIC_BYTES } from "../../utilities/magicBytes";
import { MessageBodyMap, MessageBodyType } from "./BodyCodec";
import { MessageCodec, MessageProperties, VERSION } from "./Codec";
import { hashMessage } from "./methods/hash";

export namespace Message {
	export type Properties<T extends MessageBodyType = MessageBodyType> = Omit<MessageProperties, "body"> & {
		body: MessageBodyMap[T] & {
			type: T;
		};
	};
}

export class Message<T extends MessageBodyType = MessageBodyType> implements Message.Properties<T> {
	static hash = hashMessage;

	readonly magicBytes = MAGIC_BYTES;
	readonly version = VERSION.V0;
	readonly body: MessageBodyMap[T];

	constructor(properties: RequiredProperties<Message.Properties<T>, "body">) {
		this.body = properties.body;
	}

	get buffer(): Uint8Array {
		return MessageCodec.encode(this);
	}

	get byteLength(): number {
		return MessageCodec.byteLength(this);
	}

	get hash(): Uint8Array {
		return Message.hash(this);
	}

	get properties(): Message.Properties<T> {
		const { magicBytes, version, body } = this;

		return { magicBytes, version, body };
	}
}
