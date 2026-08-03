// Dichiarazione ambient per gli asset audio: `require("*.wav")` via Metro
// risolve a un asset module ID numerico a runtime, non tipizzato di
// default da nessun pacchetto del progetto (primo asset binario di
// apps/mobile). Compatibile con `AudioSource` di expo-audio
// (`string | number | null | {...}`).
declare module "*.wav" {
  const assetId: number;
  export default assetId;
}
