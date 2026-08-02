import { registerRootComponent } from "expo";
import { App } from "./src/App";

// registerRootComponent chiama AppRegistry.registerComponent('main', ...) e
// gestisce sia Expo Go sia una build nativa, senza differenze di setup.
registerRootComponent(App);
