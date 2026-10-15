/** Cosmetic gift catalog — costs match hub spend_stars effects. */

export type GiftKind =
  | "heart"
  | "bars"
  | "fence"
  | "flowers"
  | "balloons"
  | "confetti"
  | "shooting_star"
  | "snow"
  | "spotlight"
  | "crown"
  | "disco"
  | "pass_mic"
  | "fireworks"
  | "please_stay";

export type GiftDef = {
  id: GiftKind;
  label: string;
  cost: number;
  emoji: string;
  /** Mint ★1 wallet to them. Bars / fence stay punitive. */
  grantsStar?: boolean;
};

export const GIFTS: GiftDef[] = [
  { id: "heart", label: "Heart", cost: 5, emoji: "💖", grantsStar: true },
  { id: "bars", label: "Bars", cost: 5, emoji: "🔒", grantsStar: false },
  { id: "fence", label: "Fence", cost: 5, emoji: "⛓️", grantsStar: false },
  { id: "flowers", label: "Flowers", cost: 5, emoji: "🌸", grantsStar: true },
  { id: "balloons", label: "Balloons", cost: 5, emoji: "🎈", grantsStar: true },
  { id: "confetti", label: "Confetti", cost: 5, emoji: "🎊", grantsStar: true },
  { id: "shooting_star", label: "Star", cost: 3, emoji: "★", grantsStar: true },
  { id: "pass_mic", label: "Pass mic", cost: 5, emoji: "🎤", grantsStar: true },
  { id: "fireworks", label: "Fireworks", cost: 15, emoji: "🎆", grantsStar: true },
  { id: "snow", label: "Snow", cost: 5, emoji: "❄️", grantsStar: true },
  { id: "spotlight", label: "Spotlight", cost: 5, emoji: "💡", grantsStar: true },
  { id: "crown", label: "Crown", cost: 5, emoji: "👑", grantsStar: true },
  { id: "disco", label: "Disco", cost: 5, emoji: "🪩", grantsStar: true },
  { id: "please_stay", label: "Stay", cost: 30, emoji: "🙏", grantsStar: true },
];
