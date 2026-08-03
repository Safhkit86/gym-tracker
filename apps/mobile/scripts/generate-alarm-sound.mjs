#!/usr/bin/env node
// Genera assets/sounds/rest-timer-alarm.wav: due toni brevi in sequenza
// (un "chirp"), stessa identica matematica di
// apps/web/src/utils/alarm-sound.ts (Web Audio API: oscillatore sinusoidale
// + inviluppo di guadagno esponenziale), qui scritta come campioni PCM
// direttamente in un file WAV — React Native non ha un equivalente della
// Web Audio API per sintetizzare toni al volo, quindi serve un asset audio
// reale. Nessuna dipendenza npm (solo fs/Buffer), stesso spirito "no
// dipendenze" di alarm-sound.ts. Rilancia questo script per rigenerare il
// file in modo deterministico se i parametri del suono cambiano.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SAMPLE_RATE = 44100;
const TOTAL_DURATION = 0.36; // 0.18s (tono 1) + 0.18s (tono 2), stesso timeline della webapp

/**
 * Inviluppo di guadagno esponenziale, stessa forma di
 * gain.gain.setValueAtTime(0.0001, startAt) seguito da due
 * exponentialRampToValueAtTime (0.0001 -> 0.2 in 0.02s, poi 0.2 -> 0.0001
 * fino a startAt+duration) in alarm-sound.ts. Fuori da [startAt,
 * startAt+duration] il tono e' silenzioso.
 */
function envelopeAt(t, startAt, duration) {
  const rampUpEnd = startAt + 0.02;
  const end = startAt + duration;
  if (t < startAt || t > end) {
    return 0;
  }
  const v0 = 0.0001;
  const peak = 0.2;
  if (t <= rampUpEnd) {
    const progress = (t - startAt) / (rampUpEnd - startAt);
    return v0 * (peak / v0) ** progress;
  }
  const progress = (t - rampUpEnd) / (end - rampUpEnd);
  return peak * (v0 / peak) ** progress;
}

function toneSampleAt(t, frequency, startAt, duration) {
  const gain = envelopeAt(t, startAt, duration);
  if (gain === 0) {
    return 0;
  }
  return gain * Math.sin(2 * Math.PI * frequency * (t - startAt));
}

function generateSamples() {
  const sampleCount = Math.ceil(TOTAL_DURATION * SAMPLE_RATE);
  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = toneSampleAt(t, 880, 0, 0.15) + toneSampleAt(t, 1108.73, 0.18, 0.18);
  }
  return samples;
}

function writeWavFile(filePath, samples) {
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  writeFileSync(filePath, buffer);
}

const outputPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "sounds",
  "rest-timer-alarm.wav"
);
writeWavFile(outputPath, generateSamples());
console.log(`Scritto ${outputPath}`);
