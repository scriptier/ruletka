/** Cosmetic gift catalog — costs match hub spend_stars effects. */

export type GiftKind =
  | "heart"
  | "bars"
  | "flowers"
  | "balloons"
  | "confetti"
  | "pass_mic"
  | "fireworks"
  | "please_stay";

export type GiftDef = {
  id: GiftKind;
  label: string;
  cost: number;
  emoji: string;
};

export const GIFTS: GiftDef[] = [
  { id: "heart", label: "Heart", cost: 1, emoji: "💖" },
  { id: "bars", label: "Bars", cost: 5, emoji: "🔒" },
  { id: "flowers", label: "Flowers", cost: 5, emoji: "🌸" },
  { id: "balloons", label: "Balloons", cost: 5, emoji: "🎈" },
  { id: "confetti", label: "Confetti", cost: 5, emoji: "🎊" },
  { id: "pass_mic", label: "Pass mic", cost: 5, emoji: "🎤" },
  { id: "fireworks", label: "Fireworks", cost: 15, emoji: "🎆" },
  { id: "please_stay", label: "Stay", cost: 30, emoji: "🙏" },
];
