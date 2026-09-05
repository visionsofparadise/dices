import type { Session } from "../index.js";

export const endSessionBatch = async (session: Session): Promise<void> => {
	if (session.isDirty) {
		await session.save();
	}

	session.isInBatch = false;
	session.batchSnapshot = undefined;
};
