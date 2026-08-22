import LeadAgent from "../../agents/LeadAgent.js";

const agent = new LeadAgent();

export default class LeadNode {
  async execute(state) {
    console.log("LeadNode Executed");

    return agent.execute(state);
  }
}
