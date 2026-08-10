import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last-resort UI so a JS exception shows a message instead of a silent exit.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      console.error("[ErrorBoundary]", error?.message, info?.componentStack);
    } catch {
      /* ignore */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{error.message || String(error)}</Text>
        <Pressable
          style={styles.btn}
          onPress={() => this.setState({ error: null })}
        >
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080c",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { color: "#ff8fab", fontSize: 18, fontWeight: "800" },
  body: {
    color: "#9aa8bc",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#ff2d55",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
