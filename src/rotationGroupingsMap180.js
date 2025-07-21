// rotationGroupingsMap180.js

export const rotationGroupingsMap180 = [
  // ==== TOP ====
  {
    rotation: "top",
    id: 5,
    cube: ["top", "left", "back"],
    new: ["top", "right", "front"],
  },
  {
    rotation: "top",
    id: 6,
    cube: ["top", "right", "back"],
    new: ["top", "left", "front"],
  },
  {
    rotation: "top",
    id: 7,
    cube: ["top", "left", "front"],
    new: ["top", "right", "back"],
  },
  {
    rotation: "top",
    id: 8,
    cube: ["top", "right", "front"],
    new: ["top", "left", "back"],
  },

  // ==== BOTTOM ====
  {
    rotation: "bottom",
    id: 1,
    cube: ["bottom", "left", "back"],
    new: ["bottom", "right", "front"],
  },
  {
    rotation: "bottom",
    id: 2,
    cube: ["bottom", "right", "back"],
    new: ["bottom", "left", "front"],
  },
  {
    rotation: "bottom",
    id: 3,
    cube: ["bottom", "left", "front"],
    new: ["bottom", "right", "back"],
  },
  {
    rotation: "bottom",
    id: 4,
    cube: ["bottom", "right", "front"],
    new: ["bottom", "left", "back"],
  },

  // ==== LEFT ====
  {
    rotation: "left",
    id: 5,
    cube: ["top", "left", "back"],
    new: ["bottom", "left", "front"],
  },
  {
    rotation: "left",
    id: 7,
    cube: ["top", "left", "front"],
    new: ["bottom", "left", "back"],
  },
  {
    rotation: "left",
    id: 1,
    cube: ["bottom", "left", "back"],
    new: ["top", "left", "front"],
  },
  {
    rotation: "left",
    id: 3,
    cube: ["bottom", "left", "front"],
    new: ["top", "left", "back"],
  },

  // ==== RIGHT ====
  {
    rotation: "right",
    id: 6,
    cube: ["top", "right", "back"],
    new: ["bottom", "right", "front"],
  },
  {
    rotation: "right",
    id: 8,
    cube: ["top", "right", "front"],
    new: ["bottom", "right", "back"],
  },
  {
    rotation: "right",
    id: 2,
    cube: ["bottom", "right", "back"],
    new: ["top", "right", "front"],
  },
  {
    rotation: "right",
    id: 4,
    cube: ["bottom", "right", "front"],
    new: ["top", "right", "back"],
  },

  // ==== FRONT ====
  {
    rotation: "front",
    id: 7,
    cube: ["top", "left", "front"],
    new: ["bottom", "right", "front"],
  },
  {
    rotation: "front",
    id: 8,
    cube: ["top", "right", "front"],
    new: ["bottom", "left", "front"],
  },
  {
    rotation: "front",
    id: 3,
    cube: ["bottom", "left", "front"],
    new: ["top", "right", "front"],
  },
  {
    rotation: "front",
    id: 4,
    cube: ["bottom", "right", "front"],
    new: ["top", "left", "front"],
  },

  // ==== BACK ====
  {
    rotation: "back",
    id: 5,
    cube: ["top", "left", "back"],
    new: ["bottom", "right", "back"],
  },
  {
    rotation: "back",
    id: 6,
    cube: ["top", "right", "back"],
    new: ["bottom", "left", "back"],
  },
  {
    rotation: "back",
    id: 1,
    cube: ["bottom", "left", "back"],
    new: ["top", "right", "back"],
  },
  {
    rotation: "back",
    id: 2,
    cube: ["bottom", "right", "back"],
    new: ["top", "left", "back"],
  },
];
