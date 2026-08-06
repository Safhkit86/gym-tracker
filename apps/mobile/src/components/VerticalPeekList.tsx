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
  /** Quante righe intere mostrare prima del "peek" (mezza riga) della
   *  successiva. Default 2: con una sola riga visibile (il default
   *  originale) bisognava scorrere troppo per leggere elenchi anche solo
   *  di 3-4 elementi — l'utente ha chiesto di vederne "qualche elemento
   *  in più". */
  visibleItems?: number;
}

const DEFAULT_VISIBLE_ITEMS = 2;

export function VerticalPeekList<T>({
  items,
  renderItem,
  keyExtractor,
  onIndexChange,
  visibleItems = DEFAULT_VISIBLE_ITEMS,
}: VerticalPeekListProps<T>) {
  const [itemHeight, setItemHeight] = useState(0);

  // Nessun guard "solo se non ancora misurata": alla rotazione la
  // larghezza del container cambia, il testo va a capo diversamente e
  // l'altezza reale della riga cambia — se itemHeight restasse quello
  // misurato la prima volta, maxHeight/snapToInterval userebbero un
  // valore ormai sbagliato (righe tagliate a metà, snap che si ferma nel
  // punto sbagliato). Bug latente pre-esistente, invisibile finché
  // l'orientamento restava bloccato in portrait.
  function handleFirstItemLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    if (height !== itemHeight) {
      setItemHeight(height);
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (itemHeight === 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    onIndexChange(Math.max(0, Math.min(index, items.length - 1)));
  }

  // `visibleItems` righe intere, più mezza riga della successiva come
  // "peek" — ma solo se c'è davvero una riga in più da far intravedere:
  // con `items.length <= visibleItems` niente scroll necessario, la mezza
  // riga in fondo sarebbe solo spazio vuoto.
  const fullRows = Math.min(visibleItems, items.length);
  const hasMore = items.length > visibleItems;
  const maxHeight =
    itemHeight > 0 ? itemHeight * fullRows + (hasMore ? itemHeight / 2 : 0) : undefined;

  return (
    <ScrollView
      style={maxHeight !== undefined ? { maxHeight } : undefined}
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
