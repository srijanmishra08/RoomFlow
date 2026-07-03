import { snapToNeighbours, distance3, type Footprint } from "@/lib/editor-tools";

const sofa: Footprint = { id: "a", positionX: 0, positionZ: 0, scaleX: 2, scaleZ: 1 };
const table: Footprint = { id: "b", positionX: 3, positionZ: 0, scaleX: 1, scaleZ: 1 };

describe("snapToNeighbours", () => {
  it("snaps moving edge to neighbour edge within threshold", () => {
    // sofa right edge at x+1; table left edge at 2.5. x=1.4 → right edge 2.4, 0.1 off.
    const r = snapToNeighbours(sofa, 1.4, 0, [table]);
    expect(r.snappedX).toBe(true);
    expect(r.x).toBeCloseTo(1.5); // right edge lands on 2.5
    expect(r.guideX).toBeCloseTo(2.5);
  });

  it("does not snap beyond threshold", () => {
    const r = snapToNeighbours(sofa, 0.9, 0.6, [table], undefined, 0.15);
    expect(r.snappedX).toBe(false);
    expect(r.x).toBeCloseTo(0.9);
  });

  it("snaps centers into alignment", () => {
    const r = snapToNeighbours(sofa, 3.05, 0.1, [table]);
    expect(r.snappedX).toBe(true);
    expect(r.x).toBeCloseTo(3); // center-to-center
    expect(r.snappedZ).toBe(true);
    expect(r.z).toBeCloseTo(0);
  });

  it("snaps to room walls", () => {
    // room 6 wide → wall at x=3. sofa half-width 1, x=1.9 → right edge 2.9.
    const r = snapToNeighbours(sofa, 1.9, 0, [], { width: 6, depth: 6 });
    expect(r.snappedX).toBe(true);
    expect(r.x).toBeCloseTo(2); // edge flush with wall at 3
  });

  it("ignores itself in the neighbour list", () => {
    const r = snapToNeighbours(sofa, 0.09, 0, [sofa], undefined, 0.15);
    // Only snap target would be itself at 0 → still snaps to 0 via own footprint? No: skipped.
    expect(r.snappedX).toBe(false);
  });

  it("picks the smallest correction", () => {
    const near: Footprint = { id: "c", positionX: 1.48, positionZ: 5, scaleX: 1, scaleZ: 1 };
    // center→center correction 0.03 beats edge→table-edge correction 0.05.
    const r = snapToNeighbours(sofa, 1.45, 0, [near, table]);
    expect(r.snappedX).toBe(true);
    expect(r.x).toBeCloseTo(1.48);
  });
});

describe("distance3", () => {
  it("computes 3D distance rounded to cm", () => {
    expect(distance3({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(distance3({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBeCloseTo(1.73);
  });
});
