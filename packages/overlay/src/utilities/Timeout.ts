export class Timeout {
	private start = Date.now();

	constructor(public duration: number) {}

	get isExpired() {
		return Date.now() - this.start >= this.duration;
	}
}
