/**
 * Domain error hierarchy.
 *
 * Business logic (src/server/services) and the authorization layer (src/lib/authz) throw these.
 * The action/API boundary (src/server/actions, src/app/api) translates them into an
 * `ActionState` or an HTTP response — React components never see them directly.
 */

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Input failed validation. Carries per-field messages for form rendering. */
export class ValidationError extends AppError {
  readonly fieldErrors?: FieldErrors;

  constructor(message = "Some fields need attention.", fieldErrors?: FieldErrors) {
    super("validation_error", message, 422);
    this.fieldErrors = fieldErrors;
  }
}

/** No authenticated user. */
export class AuthenticationError extends AppError {
  constructor(message = "You need to sign in to continue.") {
    super("authentication_error", message, 401);
  }
}

/** Authenticated, but not allowed to touch this resource (e.g. not a member of the couple). */
export class AuthorizationError extends AppError {
  constructor(message = "You do not have access to this.") {
    super("authorization_error", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "That could not be found.") {
    super("not_found", message, 404);
  }
}

/** A rule about current state was violated (e.g. couple already has two members). */
export class ConflictError extends AppError {
  constructor(message = "That conflicts with the current state.") {
    super("conflict", message, 409);
  }
}

/** An invalid lifecycle transition was requested (e.g. COMPLETED -> DRAFT). */
export class InvalidTransitionError extends ConflictError {
  constructor(message = "That state change is not allowed.") {
    super(message);
  }
}

/** Authenticated, but not yet part of a couple. Callers typically redirect to onboarding. */
export class CoupleRequiredError extends AppError {
  constructor(message = "Set up your couple space to continue.") {
    super("couple_required", message, 409);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
