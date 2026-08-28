import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MeasurementEntry, UserMeasurements } from "@gym-tracker/shared";
import { CsvImportError } from "../utils/csv";
import {
  MEASUREMENT_CSV_COLUMNS,
  buildMeasurementExportRows,
  importMeasurementsFromFile,
  measurementsFilename,
  parseMeasurementImportCsv,
  toCsvText,
  type PortableMeasurement,
} from "../components/measurement-import-export";

const { getMeasurementsMock, updateMeasurementsMock } = vi.hoisted(() => ({
  getMeasurementsMock: vi.fn(),
  updateMeasurementsMock: vi.fn(),
}));
vi.mock("../api/profile", () => ({
  getMeasurements: getMeasurementsMock,
  updateMeasurements: updateMeasurementsMock,
}));

const TOKEN = "test-token";

const CURRENT: UserMeasurements = {
  heightCm: 181,
  weightKg: 74,
  chestCm: null,
  armCm: 32,
  waistCm: 81,
  legCm: null,
};

const ENTRIES: MeasurementEntry[] = [
  {
    id: "m2",
    measuredOn: "2026-06-14",
    weightKg: 75.3,
    chestCm: null,
    armCm: 30,
    waistCm: 83.5,
    legCm: null,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "m1",
    measuredOn: "2026-06-07",
    weightKg: 75.3,
    chestCm: null,
    armCm: 30,
    waistCm: 87,
    legCm: null,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  },
];

function entry(overrides: Partial<PortableMeasurement> = {}): PortableMeasurement {
  return {
    measuredOn: "2026-06-14",
    weightKg: 75.3,
    chestCm: null,
    armCm: 30,
    waistCm: 83.5,
    legCm: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("measurementsFilename", () => {
  it("include la data odierna nel nome file", () => {
    expect(measurementsFilename()).toMatch(/^gym-tracker-misure-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe("buildMeasurementExportRows", () => {
  it("produce una riga di intestazione piu' una per misurazione, nell'ordine ricevuto", () => {
    const rows = buildMeasurementExportRows(ENTRIES);

    expect(rows[0]).toEqual([...MEASUREMENT_CSV_COLUMNS]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(["2026-06-14", "75.3", "", "30", "83.5", ""]);
    expect(rows[2]).toEqual(["2026-06-07", "75.3", "", "30", "87", ""]);
  });
});

describe("parseMeasurementImportCsv", () => {
  it("fa il round-trip con buildMeasurementExportRows", () => {
    const csv = toCsvText(buildMeasurementExportRows(ENTRIES));

    const result = parseMeasurementImportCsv(csv);

    expect(result).toEqual([
      {
        measuredOn: "2026-06-14",
        weightKg: 75.3,
        chestCm: null,
        armCm: 30,
        waistCm: 83.5,
        legCm: null,
      },
      {
        measuredOn: "2026-06-07",
        weightKg: 75.3,
        chestCm: null,
        armCm: 30,
        waistCm: 87,
        legCm: null,
      },
    ]);
  });

  it("tollera la virgola come separatore decimale", () => {
    const csv = "data;peso_kg;petto_cm;braccio_cm;vita_cm;gamba_cm\n2026-06-14;75,3;;;;\n";

    const result = parseMeasurementImportCsv(csv);

    expect(result[0].weightKg).toBe(75.3);
  });

  it("rifiuta un file senza la colonna obbligatoria data", () => {
    const csv = "peso_kg\n75\n";

    expect(() => parseMeasurementImportCsv(csv)).toThrow(CsvImportError);
  });

  it("rifiuta una data vuota", () => {
    const csv = "data;peso_kg\n;75\n";

    expect(() => parseMeasurementImportCsv(csv)).toThrow(/la colonna "data" è vuota/);
  });

  it("rifiuta una data mal formata", () => {
    const csv = "data;peso_kg\n14/06/2026;75\n";

    expect(() => parseMeasurementImportCsv(csv)).toThrow(/formato AAAA-MM-GG/);
  });

  it("rifiuta un file vuoto", () => {
    expect(() => parseMeasurementImportCsv("")).toThrow(/vuoto/);
  });

  it("rifiuta un numero mal formato", () => {
    const csv = "data;peso_kg\n2026-06-14;non-un-numero\n";

    expect(() => parseMeasurementImportCsv(csv)).toThrow(/non è un numero valido/);
  });
});

describe("importMeasurementsFromFile", () => {
  it("registra ogni misurazione riusando l'altezza corrente dell'account, invariata", async () => {
    getMeasurementsMock.mockResolvedValue(CURRENT);
    updateMeasurementsMock.mockResolvedValue({});

    const result = await importMeasurementsFromFile(TOKEN, [
      entry({ measuredOn: "2026-06-07", waistCm: 87 }),
      entry({ measuredOn: "2026-06-14", waistCm: 83.5 }),
    ]);

    expect(result.imported).toBe(2);
    expect(result.failed).toHaveLength(0);
    expect(updateMeasurementsMock).toHaveBeenCalledTimes(2);
    expect(updateMeasurementsMock).toHaveBeenNthCalledWith(1, TOKEN, {
      heightCm: 181,
      weightKg: 75.3,
      chestCm: null,
      armCm: 30,
      waistCm: 87,
      legCm: null,
      measuredOn: "2026-06-07",
    });
    expect(updateMeasurementsMock).toHaveBeenNthCalledWith(2, TOKEN, {
      heightCm: 181,
      weightKg: 75.3,
      chestCm: null,
      armCm: 30,
      waistCm: 83.5,
      legCm: null,
      measuredOn: "2026-06-14",
    });
  });

  it("un errore su una riga non blocca le altre, finisce in failed", async () => {
    getMeasurementsMock.mockResolvedValue(CURRENT);
    updateMeasurementsMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({});

    const result = await importMeasurementsFromFile(TOKEN, [
      entry({ measuredOn: "2026-06-07" }),
      entry({ measuredOn: "2026-06-14" }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.failed).toEqual([{ measuredOn: "2026-06-07", message: "Errore imprevisto." }]);
  });
});
