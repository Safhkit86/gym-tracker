import { Dimensions } from "react-native";

// Il preset Jest di React Native mocka le dimensioni schermo a 750x1334dp
// (vedi @react-native/jest-preset/jest/mocks/NativeModules.js) — una misura
// da tablet secondo la soglia usata da useIsTabletDevice/useResponsiveColumns
// (>= 600dp). Senza fissarla qui, ogni test esistente finirebbe per
// esercitare silenziosamente il ramo "tablet a 2+ colonne" invece di quello
// telefono, azzerando la copertura del layout telefono senza nessun errore
// esplicito (stessa categoria di failure silenziosa già vista con
// @testing-library/react-native v14, vedi CLAUDE.md). Dimensions.set()
// aggiorna anche useWindowDimensions() (stessa sottoscrizione interna),
// quindi basta chiamarlo una volta qui perché tutti i test partano da una
// misura telefono realistica; i singoli test che devono simulare un tablet
// usano l'helper setDeviceDimensions() di test/helpers.tsx.
Dimensions.set({
  window: { width: 390, height: 844, scale: 3, fontScale: 1 },
  screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
});

// expo-screen-orientation e' un modulo nativo: App.tsx lo chiama al mount
// (vedi useOrientationLock) e verrebbe importato da ogni test che monta
// App.tsx o RootNavigator — mock minimo, stesso trattamento riservato sotto
// a expo-secure-store/expo-audio.
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => {}),
  unlockAsync: jest.fn(async () => {}),
  OrientationLock: {
    PORTRAIT_UP: "PORTRAIT_UP",
    ALL: "ALL",
  },
}));

// expo-secure-store usa il Keychain/Keystore nativo: non esiste in ambiente
// Jest, quindi lo sostituiamo con un'implementazione in-memory per i test
// (jest-expo mocka molti moduli expo-*, ma non questo). La Map deve vivere
// dentro la factory: jest.mock() non permette di chiudere su variabili
// esterne non prefissate "mock" (hoisting).
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Senza questo, expo-localization legge la locale del processo Node (che
// varia da macchina a macchina), rendendo i test non deterministici: qui
// fissiamo l'italiano, coerente con la lingua di default dell'app quando
// il dispositivo non ne ha una supportata.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "it", languageTag: "it-IT" }],
}));

// expo-audio: AudioPlayer estende una classe nativa (SharedObject) non
// disponibile in ambiente Jest — a differenza di expo-haptics/expo-crypto,
// il mocking generico di jest-expo non basta, l'import nudo del modulo
// fallisce ("Cannot read properties of undefined (reading 'prototype')").
// Mock minimo con solo i metodi usati da useRestTimers.ts.
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({
    play: jest.fn(),
    seekTo: jest.fn(async () => {}),
  }),
  useAudioPlayerStatus: () => ({
    isLoaded: true,
    duration: 0.36,
    playbackState: "ready",
    reasonForWaitingToPlay: null,
    playing: false,
    currentTime: 0,
  }),
  setAudioModeAsync: jest.fn(async () => {}),
}));
