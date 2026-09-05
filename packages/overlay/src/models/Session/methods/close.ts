import type { Session } from "../index.js";

export const closeSession = async (session: Session): Promise<void> => {
	// Flush any pending changes
	if (session.isDirty) {
		await session.save();
	}

	// Clear batch state if in batch
	if (session.isInBatch) {
		session.isInBatch = false;
		session.batchSnapshot = undefined;
	}
};
