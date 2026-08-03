import { useState } from "react";
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

interface VerticalPeekListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onIndexChange: (index: number) => void;
}

/** Quanto della riga successiva resta intravisto sotto al bordo del
 *  contenitore: indizio "si può scorrere" oltre al contatore testuale nella
 *  card. Sostituisce le frecce ↑↓ di PagerControls per gli elenchi di righe
 *  (suggerimenti, esercizi di prossima/ultima sessione) — verticale, stessa
 *  direzione delle frecce che sostituisce, ma la zona di trascinamento resta
 *  volutamente bassa (una riga + questo accenno) per non creare ambiguità
 *  col scroll verticale della Dashboard in cui la card è annidata. */
const PEEK = 14;

export function VerticalPeekList<T>({
  items,
  renderItem,
  keyExtractor,
  onIndexChange,
}: VerticalPeekListProps<T>) {
  const [itemHeight, setItemHeight] = useState(0);

  function handleFirstItemLayout(event: LayoutChangeEvent) {
    if (itemHeight === 0) {
      setItemHeight(event.nativeEvent.layout.height);
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (itemHeight === 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    onIndexChange(Math.max(0, Math.min(index, items.length - 1)));
  }

  return (
    <ScrollView
      style={itemHeight > 0 ? { maxHeight: itemHeight + PEEK } : undefined}
      showsVerticalScrollIndicator={false}
      snapToInterval={itemHeight > 0 ? itemHeight : undefined}
      decelerationRate="fast"
      onScroll={handleScroll}
      scrollEventThrottle={16}
      nestedScrollEnabled
    >
      {items.map((item, index) => (
        <View
          key={keyExtractor(item, index)}
          onLayout={index === 0 ? handleFirstItemLayout : undefined}
        >
          {renderItem(item, index)}
        </View>
      ))}
    </ScrollView>
  );
}
