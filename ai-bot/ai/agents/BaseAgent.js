export default class BaseAgent {
  async execute() {
    throw new Error(
      `${this.constructor.name} must implement execute().`,
    );
  }
}