import { describe, expect, it } from "vitest";

import { classifyVisited, isSuppressed } from "@/lib/explore/visited";

describe("classifyVisited — how the couple already stands with a place", () => {
  it("'never again' or explicit not-for-us always wins, even over a high score", () => {
    expect(
      classifyVisited({ visitCount: 3, coupleScore10: 10, lastRevisit: "NO", notForUs: false }),
    ).toBe("avoid");
    expect(
      classifyVisited({ visitCount: 3, coupleScore10: 10, lastRevisit: "YES", notForUs: true }),
    ).toBe("avoid");
  });

  it("no visits => new", () => {
    expect(
      classifyVisited({ visitCount: 0, coupleScore10: null, lastRevisit: null, notForUs: false }),
    ).toBe("new");
  });

  it("revisit YES or score >= 8 => loved; MAYBE or score >= 6 => revisit; otherwise visited", () => {
    expect(
      classifyVisited({ visitCount: 1, coupleScore10: 5, lastRevisit: "YES", notForUs: false }),
    ).toBe("loved");
    expect(
      classifyVisited({ visitCount: 2, coupleScore10: 8, lastRevisit: null, notForUs: false }),
    ).toBe("loved");
    expect(
      classifyVisited({ visitCount: 2, coupleScore10: 6, lastRevisit: null, notForUs: false }),
    ).toBe("revisit");
    expect(
      classifyVisited({ visitCount: 2, coupleScore10: 4, lastRevisit: null, notForUs: false }),
    ).toBe("visited");
  });

  it("only an 'avoid' place is suppressed from recommendations", () => {
    expect(isSuppressed("avoid")).toBe(true);
    expect(isSuppressed("loved")).toBe(false);
    expect(isSuppressed("new")).toBe(false);
  });
});
