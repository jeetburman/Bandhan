/** An error whose message is safe and useful to show to the person using the app. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** What a form action hands back to its form. */
export interface ActionState {
  error: string | null;
}