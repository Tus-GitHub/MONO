/**
 * Journal-style reflection prompts. Every one is optional — they are invitations to write,
 * not fields to fill. The `field` maps to a `DateReview` column and a form input name.
 */
export interface ReflectionPrompt {
  key: string;
  field: "lovedText" | "betterText" | "rememberText" | "unexpectedText";
  question: string;
  placeholder: string;
}

export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  {
    key: "loved",
    field: "lovedText",
    question: "What did you love?",
    placeholder: "A moment, a detail, something they did…",
  },
  {
    key: "better",
    field: "betterText",
    question: "What could have been better?",
    placeholder: "No wrong answers — just honest ones.",
  },
  {
    key: "remember",
    field: "rememberText",
    question: "What do you want to remember?",
    placeholder: "The thing you'll bring up in a year.",
  },
  {
    key: "unexpected",
    field: "unexpectedText",
    question: "Anything unexpected?",
    placeholder: "A surprise, a change of plan, a first.",
  },
];
