import { RatchetStateItem } from "../index";

export const shouldRatchetStateRatchet = (ratchetState: RatchetStateItem, messageBound = RatchetStateItem.DEFAULT_MESSAGE_BOUND, timeBound = RatchetStateItem.DEFAULT_TIME_BOUND_MS): boolean => {
	if (ratchetState.rootChain.sendingChain.messageNumber >= messageBound) {
		return true;
	}

	const timeSinceRatchet = Date.now() - ratchetState.ratchetAt;

	if (timeSinceRatchet >= timeBound) {
		return true;
	}

	return false;
};
