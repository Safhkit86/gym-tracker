/**
 * Config dinamica sopra app.json (fonte statica di tutto il resto): qui si
 * decide solo se abilitare il traffico HTTP non cifrato su Android
 * (usesCleartextTraffic), in base alla variabile d'ambiente APP_VARIANT.
 *
 * Perche' serve: Android blocca di default le chiamate HTTP verso host
 * diversi da "localhost" per ogni app installata (vedi CLAUDE.md, sezione
 * `apps/mobile`) — il flag va acceso per lo sviluppo via Wi-Fi (bundle-
 * location sull'IP LAN del PC), ma non ha alcun beneficio in una build di
 * release (l'API di produzione sara' sempre HTTPS): lasciarlo acceso anche
 * li' e' solo superficie d'attacco in piu', senza motivo.
 *
 * Nessun profilo EAS Build configurato in questo progetto (la build nativa
 * si fa con `expo run:android`, vedi memoria "android-dev-toolchain"): la
 * distinzione dev/produzione e' quindi manuale, non automatica. Per una
 * build di release, imposta APP_VARIANT=production (es. in
 * apps/mobile/.env, non committato) PRIMA di lanciare il comando di build —
 * altrimenti (default, comportamento di oggi invariato) il flag resta
 * acceso.
 */
module.exports = ({ config }) => {
  const isProduction = process.env.APP_VARIANT === "production";

  const otherPlugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "expo-build-properties";
  });

  return {
    ...config,
    plugins: [
      ...otherPlugins,
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: !isProduction,
          },
        },
      ],
    ],
  };
};
