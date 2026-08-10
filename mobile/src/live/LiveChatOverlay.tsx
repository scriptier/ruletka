/**
 * In-call chat bubble overlay + empty hint + typing line.
 */
import type { RefObject } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type ChatLine = { from: string; body: string };

export type LiveChatOverlayProps = {
  visible: boolean;
  showEmptyHint: boolean;
  chat: ChatLine[];
  peerTyping: boolean;
  scrollRef: RefObject<ScrollView | null>;
  sayHiLabel: string;
  typingLabel: string;
  /** Local sender label(s) — used to style own bubbles. */
  youLabels?: string[];
  onCopyLine: (body: string) => void;
  /** Optional position tweak (browser dock lifts bubbles). */
  style?: StyleProp<ViewStyle>;
  emptyHintStyle?: StyleProp<ViewStyle>;
};

function isMine(from: string, youLabels: string[]): boolean {
  const f = String(from || "").trim().toLowerCase();
  if (!f) return false;
  if (f === "you" || f.startsWith("you ") || f.startsWith("you·") || f.startsWith("you ·")) {
    return true;
  }
  // Common i18n "you" variants
  if (f === "вы" || f === "ти" || f === "ty" || f === "tú" || f === "toi") return true;
  for (const y of youLabels) {
    const yl = String(y || "").trim().toLowerCase();
    if (yl && (f === yl || f.startsWith(yl + " ") || f.startsWith(yl + "·"))) {
      return true;
    }
  }
  return false;
}

export function LiveChatOverlay(props: LiveChatOverlayProps) {
  const {
    visible,
    showEmptyHint,
    chat,
    peerTyping,
    scrollRef,
    sayHiLabel,
    typingLabel,
    youLabels = [],
    onCopyLine,
    style,
    emptyHintStyle,
  } = props;

  if (showEmptyHint) {
    return (
      <View
        style={[styles.chatEmptyHint, emptyHintStyle]}
        pointerEvents="none"
      >
        <Text style={styles.chatEmptyHintText}>{sayHiLabel}</Text>
      </View>
    );
  }
  if (!visible) return null;

  return (
    <View style={[styles.chatOverlay, style]}>
      <ScrollView
        ref={scrollRef as RefObject<ScrollView>}
        style={styles.chatOverlayScroll}
        contentContainerStyle={styles.chatOverlayContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {chat.slice(-14).map((c, i) => {
          const mine = isMine(c.from, youLabels);
          return (
            <Pressable
              key={`${i}-${c.body.slice(0, 12)}`}
              onLongPress={() => onCopyLine(c.body)}
              delayLongPress={350}
              style={[styles.chatBubbleWrap, mine && styles.chatBubbleWrapMine]}
            >
              <View
                style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}
              >
                {!mine ? (
                  <Text style={styles.chatFrom} numberOfLines={1}>
                    {c.from}
                  </Text>
                ) : null}
                <Text style={[styles.chatLine, mine && styles.chatLineMine]}>
                  {c.body}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {peerTyping ? (
          <View style={styles.chatTypingWrap}>
            <Text style={styles.chatTyping}>{typingLabel}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
