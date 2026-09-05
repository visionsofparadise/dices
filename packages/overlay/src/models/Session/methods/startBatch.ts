import { DicesOverlayError } from "../../Error/index";
import type { Session } from "../index";

export const startSessionBatch = (session: Session): void => {
	if (session.isInBatch) {
		throw new DicesOverlayError("Already in batch mode");
	}

	// Snapshot current state for rollback
	if (session.ratchetState) {
		session.batchSnapshot = session.ratchetState.buffer;
	}

	session.isInBatch = true;
};
