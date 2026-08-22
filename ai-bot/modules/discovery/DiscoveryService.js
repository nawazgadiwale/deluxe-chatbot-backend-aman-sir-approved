import DiscoveryEngine from "./DiscoveryEngine.js";
import DiscoveryValidator from "./DiscoveryValidator.js";

const engine = new DiscoveryEngine();
const validator = new DiscoveryValidator();

export default class DiscoveryService {
  async generate(state) {
    const result = await engine.generate(state);

    return validator.validate(result);
  }
}