import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "./helpers";
import { ExerciseCombobox } from "../screens/workouts/ExerciseCombobox";
import { groupByMuscle } from "../utils/workout-form-utils";

const catalog = [
  {
    id: "e1",
    userId: null,
    name: "Panca piana",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
  {
    id: "e2",
    userId: null,
    name: "Squat",
    muscleGroup: "Gambe",
    description: null,
    sourceUrl: null,
  },
];

const groupedCatalog = groupByMuscle(catalog);

describe("ExerciseCombobox", () => {
  it("permette di scegliere un esercizio diverso dalla tendina e notifica apertura/chiusura", async () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();

    const screen = await renderWithProviders(
      <ExerciseCombobox
        value="e1"
        selected={catalog[0]}
        groupedCatalog={groupedCatalog}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />
    );

    const field = screen.getByLabelText("Esercizio");
    expect(field.props.value).toBe("Panca piana");

    fireEvent(field, "focus");
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    // Bug riportato: "non si riesce piu' a modificare il nome di un
    // esercizio... scegliendo dalla combo box" — questa e' la meccanica di
    // selezione in se', verificata qui isolata da ExerciseCombobox (vedi
    // WorkoutForm.test.tsx per la parte di zIndex/elevation fra card).
    fireEvent.press(screen.getByRole("button", { name: "Squat" }));

    expect(onChange).toHaveBeenCalledWith("e2");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
