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
