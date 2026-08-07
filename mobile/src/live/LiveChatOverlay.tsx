/**
 * In-call chat bubble overlay + empty hint + typing line.
 */
import type { RefObject } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
  onCopyLine: (body: string) => void;
};

export function LiveChatOverlay(props: LiveChatOverlayProps) {
  const {
    visible,
    showEmptyHint,
    chat,
    peerTyping,
    scrollRef,
    sayHiLabel,
    typingLabel,
    onCopyLine,
  } = props;

  if (showEmptyHint) {
    return (
      <View style={styles.chatEmptyHint} pointerEvents="none">
        <Text style={styles.chatEmptyHintText}>{sayHiLabel}</Text>
      </View>
    );
  }
  if (!visible) return null;

  return (
    <View style={styles.chatOverlay}>
      <ScrollView
        ref={scrollRef as RefObject<ScrollView>}
        style={styles.chatOverlayScroll}
        contentContainerStyle={styles.chatOverlayContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {chat.slice(-12).map((c, i) => (
          <Pressable
            key={`${i}-${c.body.slice(0, 12)}`}
            onLongPress={() => onCopyLine(c.body)}
            delayLongPress={350}
          >
            <Text style={styles.chatLine}>
              <Text style={styles.chatFrom}>{c.from}: </Text>
              {c.body}
            </Text>
          </Pressable>
        ))}
        {peerTyping ? (
          <Text style={styles.chatTyping}>{typingLabel}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
