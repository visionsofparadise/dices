import type { Session } from "../index.js";
import { RatchetStateItem } from "../../RatchetStateItem/index.js";
import { RatchetStateItemValueCodec } from "../../RatchetStateItem/Codec.js";

export const cancelSessionBatch = (session: Session): void => {
	// Restore from snapshot if available
	if (session.batchSnapshot && session.ratchetState) {
		const decodedValue = RatchetStateItemValueCodec.decode(session.batchSnapshot);
		session.ratchetState = new RatchetStateItem({
			indexKey: RatchetStateItem.INDEX_KEY,
			ratchetId: session.ratchetId,
			...decodedValue,
		});
	}

	session.isInBatch = false;
	session.isDirty = false;
	session.batchSnapshot = undefined;
};
