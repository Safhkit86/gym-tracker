import { type Kysely, sql } from "kysely";

interface NewExercise {
  name: string;
  muscleGroup: string;
  description: string;
}

/**
 * Esercizi comuni da sala pesi non ancora nel catalogo, individuati con un
 * confronto per gruppo muscolare e confermati dall'utente. "Dip alle
 * parallele" (Tricipiti) e' stato scartato perche' duplicato di "Dip"
 * (Petto, gia' a parallele); "Abduttori (macchina)" e' stato accorpato a
 * Gambe insieme ad "Adduttori" invece di essere ripetuto anche in Glutei.
 */
const NEW_EXERCISES: ReadonlyArray<NewExercise> = [
  // --- Petto ---
  {
    name: "Panca inclinata con manubri",
    muscleGroup: "Petto",
    description:
      "Sdraiato su una panca inclinata (30-45 gradi) con un manubrio in ogni mano: spingi i manubri verso l'alto fino a quasi toccarli sopra la parte alta del petto, poi torna giu' controllando la discesa. Coinvolge maggiormente la parte alta del petto rispetto alla panca piana.",
  },
  {
    name: "Panca declinata",
    muscleGroup: "Petto",
    description:
      "Sdraiato su una panca declinata con i piedi bloccati in alto, bilanciere o manubri alle spalle: spingi verso l'alto estendendo le braccia, poi torna giu' controllando la discesa. Enfatizza la parte bassa del petto.",
  },
  {
    name: "Croci ai cavi",
    muscleGroup: "Petto",
    description:
      "In piedi al centro di una stazione a cavi con le pulegge alte, un maniglione per mano: porta le braccia in avanti e verso il basso con un movimento ad arco fino a incrociarle davanti al petto, mantenendo un leggero piegamento dei gomiti, poi torna lentamente alla posizione di partenza.",
  },
  {
    name: "Pec deck",
    muscleGroup: "Petto",
    description:
      "Seduto alla macchina pec deck con la schiena appoggiata allo schienale e gli avambracci sui supporti imbottiti: porta le braccia in avanti fino a farle quasi toccare davanti al petto, poi torna indietro controllando l'apertura senza forzare le spalle.",
  },
  {
    name: "Pullover con manubrio",
    muscleGroup: "Petto",
    description:
      "Sdraiato trasversalmente su una panca piana con le spalle appoggiate e i fianchi in basso, un manubrio tenuto con entrambe le mani sopra il petto: porta il manubrio dietro la testa mantenendo un leggero piegamento dei gomiti, poi torna alla posizione di partenza contraendo petto e dorsali.",
  },
  // --- Schiena ---
  {
    name: "T-bar row",
    muscleGroup: "Schiena",
    description:
      "In piedi sopra un bilanciere ancorato a terra da un lato (o su un'apposita macchina T-bar), busto flesso in avanti e presa sulla maniglia: tira il bilanciere verso l'addome contraendo la schiena, poi torna giu' controllando la discesa senza inarcare troppo la zona lombare.",
  },
  {
    name: "Rematore presa inversa",
    muscleGroup: "Schiena",
    description:
      "In piedi con busto flesso in avanti, presa supina (palmi verso di te) sul bilanciere: tira il bilanciere verso l'addome portando i gomiti vicino al corpo, poi torna giu' controllando la discesa. La presa inversa coinvolge maggiormente dorsali e bicipiti.",
  },
  {
    name: "Iperestensioni",
    muscleGroup: "Schiena",
    description:
      "Sul banco per iperestensioni con i fianchi appoggiati al supporto e le caviglie bloccate: piega il busto in avanti fino a un angolo di circa 90 gradi, poi risali contraendo i lombari e i glutei, senza inarcare eccessivamente la schiena a fine movimento.",
  },
  {
    name: "Trazioni assistite",
    muscleGroup: "Schiena",
    description:
      "Sulla macchina per trazioni assistite, in ginocchio sulla pedana con il contrappeso che sostiene parte del peso corporeo: tira il corpo verso l'alto fino a portare il mento sopra la sbarra, poi scendi controllando la discesa. Utile come progressione verso le trazioni a corpo libero.",
  },
  {
    name: "Face pull",
    muscleGroup: "Schiena",
    description:
      "Alla stazione a cavi con la puleggia all'altezza del viso e una corda: tira la corda verso il viso separando le mani a fine movimento e ruotando le spalle all'indietro, poi torna lentamente in avanti. Lavora il deltoide posteriore e i muscoli rotatori della spalla.",
  },
  {
    name: "Meadows row",
    muscleGroup: "Schiena",
    description:
      "In piedi di fianco a un bilanciere ancorato a un'estremita' (landmine), busto flesso in avanti, presa con una mano vicino al disco: tira il bilanciere verso il fianco contraendo la schiena, poi torna giu' controllando la discesa. Rematore monolaterale con un range di movimento ampio.",
  },
  // --- Spalle ---
  {
    name: "Shoulder press con manubri",
    muscleGroup: "Spalle",
    description:
      "Seduto o in piedi con un manubrio per mano all'altezza delle spalle, palmi in avanti: spingi i manubri verso l'alto fino a distendere le braccia sopra la testa, poi torna giu' controllando la discesa.",
  },
  {
    name: "Alzate laterali ai cavi",
    muscleGroup: "Spalle",
    description:
      "In piedi di fianco alla puleggia bassa, maniglione nella mano piu' lontana dalla macchina: solleva il braccio lateralmente fino all'altezza della spalla mantenendo un leggero piegamento del gomito, poi torna giu' controllando la discesa. La tensione ai cavi resta costante per tutto il movimento.",
  },
  {
    name: "Tirate al mento",
    muscleGroup: "Spalle",
    description:
      "In piedi con un bilanciere (o manubri) tenuto con presa stretta davanti alle cosce: solleva il bilanciere lungo il corpo fino all'altezza del mento, portando i gomiti verso l'alto e verso l'esterno, poi torna giu' controllando la discesa.",
  },
  {
    name: "Push press",
    muscleGroup: "Spalle",
    description:
      "In piedi con un bilanciere alle spalle: fletti leggermente le ginocchia e spingi con le gambe per dare slancio, poi distendi le braccia sopra la testa completando la spinta. Permette di sollevare carichi maggiori rispetto alla military press strict.",
  },
  {
    name: "Reverse pec deck",
    muscleGroup: "Spalle",
    description:
      "Seduto alla macchina pec deck rivolto verso lo schienale, con le braccia sui supporti davanti a te: apri le braccia lateralmente contraendo la parte posteriore delle spalle, poi torna avanti controllando il movimento.",
  },
  // --- Bicipiti ---
  {
    name: "Concentration curl",
    muscleGroup: "Bicipiti",
    description:
      "Seduto su una panca, gomito appoggiato alla parte interna della coscia e un manubrio in mano: fletti il gomito portando il manubrio verso la spalla, poi torna giu' controllando la discesa. L'appoggio del gomito isola il bicipite riducendo lo slancio.",
  },
  {
    name: "Curl 21",
    muscleGroup: "Bicipiti",
    description:
      "Con un bilanciere o manubri, esegui 7 ripetizioni parziali nella meta' inferiore del movimento, poi 7 nella meta' superiore, infine 7 a range completo, per un totale di 21 ripetizioni senza pausa tra le fasi.",
  },
  {
    name: "Drag curl",
    muscleGroup: "Bicipiti",
    description:
      "In piedi con un bilanciere davanti alle cosce: fletti i gomiti facendo scorrere il bilanciere lungo il corpo (quasi a contatto), portando i gomiti indietro invece che in avanti, poi torna giu' controllando la discesa. Riduce il coinvolgimento delle spalle rispetto al curl classico.",
  },
  {
    name: "Cable hammer curl",
    muscleGroup: "Bicipiti",
    description:
      "Alla stazione a cavi con una corda alla puleggia bassa, presa neutra (palmi rivolti l'uno verso l'altro): fletti i gomiti portando la corda verso le spalle, poi torna giu' controllando la discesa. Variante a tensione costante del curl a martello.",
  },
  // --- Tricipiti ---
  {
    name: "Estensioni sopra la testa",
    muscleGroup: "Tricipiti",
    description:
      "Seduto o in piedi con un manubrio tenuto con entrambe le mani sopra la testa, gomiti puntati in avanti: piega i gomiti abbassando il manubrio dietro la testa, poi distendi le braccia tornando alla posizione di partenza.",
  },
  {
    name: "JM press",
    muscleGroup: "Tricipiti",
    description:
      "Sdraiato su una panca piana con un bilanciere, a meta' strada tra una panca a presa stretta e un french press: abbassa il bilanciere verso la gola piegando i gomiti, poi spingi verso l'alto in un unico movimento fluido. Esercizio ibrido molto usato per i tricipiti con carichi pesanti.",
  },
  // --- Gambe ---
  {
    name: "Front squat",
    muscleGroup: "Gambe",
    description:
      "Con un bilanciere appoggiato sulla parte anteriore delle spalle (presa a croce o pulita), piedi larghezza spalle: scendi piegando ginocchia e fianchi mantenendo il busto eretto, poi risali spingendo sui talloni. La posizione del bilanciere richiede piu' controllo del core e coinvolge maggiormente i quadricipiti rispetto al back squat.",
  },
  {
    name: "Squat sumo",
    muscleGroup: "Gambe",
    description:
      "Piedi molto piu' larghi delle spalle e punte leggermente ruotate verso l'esterno, bilanciere o manubrio tenuto davanti o alle spalle: scendi piegando ginocchia e fianchi mantenendo le ginocchia in linea con le punte dei piedi, poi risali. Coinvolge maggiormente adduttori e glutei rispetto allo squat classico.",
  },
  {
    name: "Goblet squat",
    muscleGroup: "Gambe",
    description:
      "In piedi con un manubrio o un kettlebell tenuto verticalmente davanti al petto con entrambe le mani: scendi piegando ginocchia e fianchi mantenendo il busto eretto, poi risali spingendo sui talloni. Ottimo per imparare la tecnica dello squat grazie al contrappeso frontale.",
  },
  {
    name: "Adduttori",
    muscleGroup: "Gambe",
    description:
      "Seduto alla macchina per adduttori con le gambe appoggiate ai cuscinetti laterali, gambe leggermente aperte: chiudi le gambe verso il centro contraendo la parte interna della coscia, poi torna all'apertura di partenza controllando il movimento.",
  },
  {
    name: "Abduttori",
    muscleGroup: "Gambe",
    description:
      "Seduto alla macchina per abduttori con le gambe appoggiate ai cuscinetti laterali, gambe chiuse: apri le gambe verso l'esterno contraendo glutei e parte esterna della coscia, poi torna alla posizione di partenza controllando il movimento.",
  },
  {
    name: "Leg curl in piedi",
    muscleGroup: "Gambe",
    description:
      "In piedi alla macchina per leg curl, una gamba alla volta contro il cuscinetto posteriore: fletti il ginocchio portando il tallone verso il gluteo, poi torna giu' controllando la discesa. Variante monolaterale del leg curl da sdraiato.",
  },
  // --- Glutei ---
  {
    name: "Frog pump",
    muscleGroup: "Glutei",
    description:
      "Sdraiato a terra con le piante dei piedi unite e le ginocchia aperte verso l'esterno (posizione a rana): solleva il bacino contraendo i glutei fino a estendere completamente i fianchi, poi torna giu' controllando la discesa.",
  },
  // --- Polpacci ---
  {
    name: "Calf su leg press",
    muscleGroup: "Polpacci",
    description:
      "Seduto alla leg press con solo la punta dei piedi appoggiata alla pedana, gambe quasi distese: spingi con le punte dei piedi estendendo le caviglie, poi torna giu' allungando i polpacci controllando il movimento.",
  },
  {
    name: "Calf monopodalico",
    muscleGroup: "Polpacci",
    description:
      "In piedi su un gradino o un rialzo con una sola gamba, l'altra sollevata da terra: sali sulla punta del piede estendendo la caviglia, poi scendi controllando la discesa fino a sentire un buon allungamento del polpaccio. Puoi aiutarti con un manubrio o un supporto per l'equilibrio.",
  },
  // --- Addome ---
  {
    name: "Russian twist",
    muscleGroup: "Addome",
    description:
      "Seduto a terra con le ginocchia piegate e il busto inclinato indietro di circa 45 gradi, piedi sollevati da terra o appoggiati: ruota il busto da un lato all'altro toccando (o portando un peso) accanto ai fianchi, mantenendo l'addome contratto per tutto il movimento.",
  },
  {
    name: "Sit-up",
    muscleGroup: "Addome",
    description:
      "Sdraiato a terra con le ginocchia piegate e i piedi appoggiati (eventualmente bloccati): solleva l'intero busto da terra fino a portarlo verso le ginocchia, poi torna giu' controllando la discesa. Range di movimento piu' ampio rispetto al crunch.",
  },
  {
    name: "Crunch ai cavi",
    muscleGroup: "Addome",
    description:
      "In ginocchio davanti a una puleggia alta con una corda tenuta ai lati della testa: fletti il busto in avanti contraendo l'addome, portando i gomiti verso le ginocchia, poi torna su controllando il movimento.",
  },
  {
    name: "Mountain climber",
    muscleGroup: "Addome",
    description:
      "In posizione di plank con le braccia distese: porta velocemente un ginocchio verso il petto e poi l'altro, alternando le gambe come in una corsa, mantenendo l'addome contratto e i fianchi bassi per tutto il movimento.",
  },
  {
    name: "Woodchopper ai cavi",
    muscleGroup: "Addome",
    description:
      "In piedi di fianco a una puleggia alta (o bassa), maniglione tenuto con entrambe le mani: tira il cavo diagonalmente attraverso il corpo, ruotando busto e fianchi, poi torna alla posizione di partenza controllando il movimento. Lavora gli obliqui con un pattern rotazionale.",
  },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const exercise of NEW_EXERCISES) {
    await sql`INSERT INTO exercises (name, muscle_group, description, source_url, owner_id) VALUES (${exercise.name}, ${exercise.muscleGroup}, ${exercise.description}, NULL, NULL)`.execute(
      db
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const names = NEW_EXERCISES.map((e) => e.name);
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ANY(${names})`.execute(db);
}
