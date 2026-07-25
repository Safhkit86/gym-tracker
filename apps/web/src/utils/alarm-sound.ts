/**
 * Suono di allarme sintetizzato via Web Audio API: nessun file/dipendenza
 * npm da caricare, stesso spirito "no dipendenze" di components/icons.tsx.
 * Due toni brevi in sequenza (un "chirp" moderno), non un unico beep piatto.
 */

let sharedAudioContext: AudioContext | null = null;

/** Va chiamata durante un vero gesto utente (es. il click che avvia il
 *  timer): crea/riprende l'AudioContext subito, cosi' quando il beep viene
 *  poi innescato da un setInterval (non un click) le autoplay policy del
 *  browser non lo bloccano. */
export function unlockAlarmAudio(): void {
  const context = getAudioContext();
  if (context.state === "suspended") {
    void context.resume();
  }
}

function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

function playTone(
  context: AudioContext,
  startAt: number,
  frequency: number,
  duration: number
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

/** Due toni ravvicinati (chirp), non un beep piatto. */
export function playAlarmBeep(): void {
  const context = getAudioContext();
  if (context.state === "suspended") {
    void context.resume();
  }
  const now = context.currentTime;
  playTone(context, now, 880, 0.15);
  playTone(context, now + 0.18, 1108.73, 0.18);
}
