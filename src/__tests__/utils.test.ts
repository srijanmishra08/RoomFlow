import { statusColor, statusLabel, formatCurrency, getInitials } from "@/lib/utils";

describe("utils", () => {
  describe("statusColor", () => {
    it("returns green for FINALIZED", () => {
      expect(statusColor("FINALIZED")).toBe("#22c55e");
    });

    it("returns yellow for IN_PROGRESS", () => {
      expect(statusColor("IN_PROGRESS")).toBe("#eab308");
    });

    it("returns grey for PLANNED", () => {
      expect(statusColor("PLANNED")).toBe("#9ca3af");
    });

    it("returns grey for unknown status", () => {
      expect(statusColor("UNKNOWN")).toBe("#9ca3af");
    });
  });

  describe("statusLabel", () => {
    it("returns 'Finalized' for FINALIZED", () => {
      expect(statusLabel("FINALIZED")).toBe("Finalized");
    });

    it("returns 'In Progress' for IN_PROGRESS", () => {
      expect(statusLabel("IN_PROGRESS")).toBe("In Progress");
    });

    it("returns 'Planned' for PLANNED", () => {
      expect(statusLabel("PLANNED")).toBe("Planned");
    });
  });

  describe("formatCurrency", () => {
    it("formats INR correctly", () => {
      const result = formatCurrency(32000, "INR");
      expect(result).toContain("32,000");
    });
  });

  describe("getInitials", () => {
    it("returns initials for a full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("returns single initial for single name", () => {
      expect(getInitials("Alice")).toBe("A");
    });

    it("caps at 2 characters", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });
  });
});
