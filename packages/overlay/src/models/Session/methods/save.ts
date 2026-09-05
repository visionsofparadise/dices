import { DicesOverlayError } from "../../Error/index";
import type { Session } from "../index";

export const saveSession = async (session: Session): Promise<void> => {
	if (!session.ratchetState) {
		return;
	}

	if (!session.isDirty) {
		return;
	}

	try {
		await session.ratchetState.put(session.overlay);
		session.isDirty = false;
	} catch (error) {
		throw new DicesOverlayError("Failed to save ratchet state", { cause: error });
	}
};
