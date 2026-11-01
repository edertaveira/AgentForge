export class WaitingForInputError extends Error {
  constructor(
    readonly workItemId: string,
    readonly questions: string[],
  ) {
    super(`WAITING_FOR_JIRA_INPUT: ${questions.join("; ")}`);
    this.name = "WaitingForInputError";
  }
}
