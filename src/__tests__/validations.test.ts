import {
  registerSchema,
  loginSchema,
  createProjectSchema,
  createRoomSchema,
  createObjectSchema,
  createCommentSchema,
  createClientSchema,
  updateProfileSchema,
  createApprovalSchema,
} from "@/lib/validations";

describe("validations", () => {
  describe("registerSchema", () => {
    it("accepts valid data", () => {
      const result = registerSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects short password", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createProjectSchema", () => {
    it("accepts valid project", () => {
      const result = createProjectSchema.safeParse({
        title: "My Project",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const result = createProjectSchema.safeParse({
        title: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createRoomSchema", () => {
    it("accepts valid room", () => {
      const result = createRoomSchema.safeParse({
        name: "Living Room",
        width: 5,
        height: 3,
        depth: 5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative dimensions", () => {
      const result = createRoomSchema.safeParse({
        name: "Room",
        width: -1,
        height: 3,
        depth: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createObjectSchema", () => {
    it("accepts valid object", () => {
      const result = createObjectSchema.safeParse({
        name: "Sofa",
        status: "PLANNED",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = createObjectSchema.safeParse({
        name: "Sofa",
        status: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createCommentSchema", () => {
    it("accepts valid comment", () => {
      const result = createCommentSchema.safeParse({
        content: "Looks great!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty comment", () => {
      const result = createCommentSchema.safeParse({
        content: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createClientSchema", () => {
    it("accepts valid client", () => {
      const result = createClientSchema.safeParse({
        name: "Client Name",
        email: "client@email.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateProfileSchema", () => {
    it("accepts valid profile update", () => {
      const result = updateProfileSchema.safeParse({
        name: "New Name",
        studioName: "My Studio",
        phone: "+91 123456",
        bio: "A short bio",
      });
      expect(result.success).toBe(true);
    });

    it("allows partial updates", () => {
      const result = updateProfileSchema.safeParse({
        name: "New Name",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = updateProfileSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createApprovalSchema", () => {
    it("accepts APPROVED status", () => {
      const result = createApprovalSchema.safeParse({
        status: "APPROVED",
      });
      expect(result.success).toBe(true);
    });

    it("accepts REJECTED with note", () => {
      const result = createApprovalSchema.safeParse({
        status: "REJECTED",
        note: "Needs changes",
      });
      expect(result.success).toBe(true);
    });

    it("accepts REVISION_REQUESTED", () => {
      const result = createApprovalSchema.safeParse({
        status: "REVISION_REQUESTED",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = createApprovalSchema.safeParse({
        status: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });
});
