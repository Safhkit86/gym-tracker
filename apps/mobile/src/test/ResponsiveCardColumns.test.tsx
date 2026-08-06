import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { ResponsiveCardColumns } from "../components/ResponsiveCardColumns";

/** Estrae, per ogni colonna resa, i testi delle card al suo interno —
 *  la struttura è sempre `<row><column>...children</column></row>`, vedi
 *  ResponsiveCardColumns.tsx. */
function columnTexts(tree: ReturnType<typeof render>): string[][] {
  const json = tree.toJSON();
  const row = Array.isArray(json) ? json[0] : json;
  const columns: unknown[] = row?.children ?? [];
  return columns.map((column: unknown) => {
    function collectText(node: unknown): string[] {
      if (typeof node === "string") {
        return [node];
      }
      if (node && typeof node === "object" && "children" in node) {
        const children = (node as { children: unknown[] | null }).children ?? [];
        return children.flatMap(collectText);
      }
      return [];
    }
    return collectText(column);
  });
}

describe("ResponsiveCardColumns", () => {
  it("con una sola colonna renderizza tutte le card in ordine, senza bucketing", () => {
    const tree = render(
      <ResponsiveCardColumns columns={1}>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
      </ResponsiveCardColumns>
    );
    expect(tree.getByText("A")).toBeTruthy();
    expect(tree.getByText("B")).toBeTruthy();
    expect(tree.getByText("C")).toBeTruthy();
  });

  it("senza weights distribuisce round-robin per indice (comportamento originale)", () => {
    const tree = render(
      <ResponsiveCardColumns columns={2}>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
        <Text>D</Text>
      </ResponsiveCardColumns>
    );
    expect(columnTexts(tree)).toEqual([
      ["A", "C"],
      ["B", "D"],
    ]);
  });

  it("con weights assegna ogni card alla colonna con il totale più basso finora", () => {
    // A pesa 4 quanto B+C+D messe insieme: round-robin per indice
    // metterebbe A e C nella stessa colonna (indici 0 e 2), qui invece A
    // da sola basta a riempire una colonna, le altre tre si dividono le
    // colonne restanti.
    const tree = render(
      <ResponsiveCardColumns columns={3} weights={[4, 1, 1, 1]}>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
        <Text>D</Text>
      </ResponsiveCardColumns>
    );
    expect(columnTexts(tree)).toEqual([["A"], ["B", "D"], ["C"]]);
  });

  it("ignora weights se la lunghezza non combacia con le card (torna a round-robin)", () => {
    const tree = render(
      <ResponsiveCardColumns columns={2} weights={[10]}>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
      </ResponsiveCardColumns>
    );
    expect(columnTexts(tree)).toEqual([["A", "C"], ["B"]]);
  });
});
