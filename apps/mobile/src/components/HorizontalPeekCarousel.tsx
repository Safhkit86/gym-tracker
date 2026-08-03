import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { spacing } from "../theme/theme";

interface HorizontalPeekCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onIndexChange: (index: number) => void;
  /** Frazione della larghezza disponibile occupata da un elemento: il resto
   *  resta visibile come "intravisto" dell'elemento successivo, indizio che
   *  si può scorrere lateralmente (sostituisce le frecce ‹ › di
   *  PagerControls per i widget con elementi affiancati in riga, es. i
   *  gruppi muscolari — orizzontale perché non ha nessuna ambiguità col
   *  scroll verticale della pagina, a differenza di un elenco di righe). */
  widthRatio?: number;
}

const GAP = spacing.sm;

export function HorizontalPeekCarousel<T>({
  items,
  renderItem,
  keyExtractor,
  onIndexChange,
  widthRatio = 0.62,
}: HorizontalPeekCarouselProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const itemWidth = containerWidth * widthRatio;

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (itemWidth === 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.x / (itemWidth + GAP));
    onIndexChange(Math.max(0, Math.min(index, items.length - 1)));
  }

  return (
    <View onLayout={handleLayout}>
      {containerWidth > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemWidth + GAP}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
        >
          {items.map((item, index) => (
            <View key={keyExtractor(item, index)} style={{ width: itemWidth }}>
              {renderItem(item, index)}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: GAP,
  },
});
