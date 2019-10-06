export default class GatewayError extends Error {
  constructor(public code: number, public message: string = 'An unidentified error occurred') {
    super();
  }

  public toString() {
    return `GatewayError: [${this.code}] ${this.message}`;
  }
  get payload() {
    return {
      code: this.code,
      message: this.message
    };
  }
}
