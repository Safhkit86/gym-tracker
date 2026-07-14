import { type Kysely, sql } from "kysely";

/**
 * Arricchisce il catalogo esercizi: descrizione di esecuzione per tutti, e
 * un link "scopri di piu'" (pagina sorgente, non media incorporati) solo
 * dove verificato con una ricerca puntuale. Fonte principale: ProjectInvictus
 * (projectinvictus.it), integrata con nozioni standard di forma per gli
 * esercizi senza una pagina specifica verificata.
 */
const DESCRIPTION_UPDATES: ReadonlyArray<{
  name: string;
  description: string;
  sourceUrl?: string;
}> = [
  {
    name: "Panca piana",
    description:
      "Sdraiati sulla panca con i piedi ben piantati a terra, afferra il bilanciere con presa poco piu' larga delle spalle. Scendi controllando il bilanciere fino a sfiorare il petto, poi spingi verso l'alto fino a estendere i gomiti, mantenendo le scapole addotte.",
    sourceUrl: "https://www.projectinvictus.it/la-panca-piana-nel-bodybuilding/",
  },
  {
    name: "Squat",
    description:
      "Bilanciere sulle spalle, piedi larghezza spalle: scendi flettendo anche e ginocchia mantenendo la schiena neutra, fino a portare le cosce parallele al pavimento, poi risali spingendo sui talloni.",
    sourceUrl: "https://www.projectinvictus.it/squat-la-guida-completa/",
  },
  {
    name: "Stacco da terra",
    description:
      "Bilanciere a terra sopra il centro del piede: afferra il bilanciere con schiena neutra, spingi con le gambe e distendi le anche fino alla posizione eretta, mantenendo il bilanciere vicino al corpo.",
    sourceUrl: "https://www.projectinvictus.it/stacco-da-terra/",
  },
  {
    name: "Trazioni alla sbarra",
    description:
      "Appenditi alla sbarra con presa prona poco piu' larga delle spalle, tira portando il petto verso la sbarra fino a superarla col mento, controllando la discesa.",
    sourceUrl: "https://www.projectinvictus.it/trazioni-alla-sbarra/",
  },
  {
    name: "Military press",
    description:
      "In piedi o seduto, bilanciere all'altezza delle clavicole: spingi verticalmente sopra la testa fino a estendere le braccia, mantenendo il core stabile.",
  },
  {
    name: "Rematore con bilanciere",
    description:
      "Busto flesso in avanti a circa 45 gradi, schiena neutra: tira il bilanciere verso l'addome mantenendo i gomiti vicini al corpo, poi distendi controllando il peso in discesa.",
  },
  {
    name: "Curl con bilanciere",
    description:
      "In piedi, bilanciere con presa supina: fletti i gomiti portando il bilanciere verso le spalle, mantenendo i gomiti fermi lungo i fianchi.",
  },
  {
    name: "French press",
    description:
      "Sdraiato o in piedi, bilanciere o manubrio dietro la testa: estendi i gomiti mantenendoli fermi, senza muovere le spalle.",
  },
  {
    name: "Leg press",
    description:
      "Seduto sulla macchina, spingi la pedana con i piedi larghezza spalle fino a estendere quasi completamente le ginocchia, senza bloccarle di scatto.",
  },
  {
    name: "Affondi",
    description:
      "Un passo in avanti, scendi flettendo entrambe le ginocchia fino a circa 90 gradi, il ginocchio posteriore quasi a sfiorare il pavimento, poi torna alla posizione di partenza spingendo sul tallone anteriore.",
  },
];

interface NewExercise {
  name: string;
  muscleGroup: string;
  description: string;
  sourceUrl?: string;
}

const NEW_EXERCISES: ReadonlyArray<NewExercise> = [
  // --- Petto ---
  {
    name: "Panca inclinata",
    muscleGroup: "Petto",
    description:
      "Come la panca piana ma su panca inclinata (30-45 gradi): sposta il lavoro sul fascio clavicolare del pettorale. Mantieni i gomiti a circa 45 gradi dal busto durante la discesa.",
  },
  {
    name: "Dip",
    muscleGroup: "Petto",
    description:
      "Alle parallele, scendi flettendo i gomiti mantenendo il busto leggermente inclinato in avanti per coinvolgere di piu' il petto, poi spingi verso l'alto fino a estendere le braccia.",
  },
  {
    name: "Croci con manubri",
    muscleGroup: "Petto",
    description:
      "Sdraiato su panca piana con un manubrio per mano, apri le braccia con gomiti leggermente flessi fino a sentire lo stiramento del pettorale, poi richiudi senza far toccare i manubri.",
  },
  {
    name: "Chest press",
    muscleGroup: "Petto",
    description:
      "Alla macchina, spingi le maniglie in avanti mantenendo la schiena aderente allo schienale, senza bloccare completamente i gomiti a fine spinta.",
  },
  {
    name: "Piegamenti",
    muscleGroup: "Petto",
    description:
      "A corpo libero: mani a terra poco piu' larghe delle spalle, corpo in linea retta dalla testa ai talloni. Scendi flettendo i gomiti fino a sfiorare il pavimento col petto, poi risali.",
  },
  // --- Schiena ---
  {
    name: "Lat machine",
    muscleGroup: "Schiena",
    description:
      "Seduto con le cosce bloccate, tira la barra verso l'alto del petto portando i gomiti verso il basso e indietro, senza inarcare eccessivamente la schiena.",
  },
  {
    name: "Pulley basso",
    muscleGroup: "Schiena",
    description:
      "Seduto con le ginocchia leggermente flesse, tira la maniglia verso l'addome mantenendo il busto stabile, poi torna controllando l'allungamento.",
  },
  {
    name: "Rematore con manubrio",
    muscleGroup: "Schiena",
    description:
      "Un ginocchio e una mano in appoggio sulla panca, tira il manubrio verso il fianco mantenendo il gomito vicino al corpo.",
  },
  {
    name: "Pull-down ai cavi",
    muscleGroup: "Schiena",
    description:
      "Variante della lat machine con maggiore liberta' di traiettoria: tira la barra verso il petto mantenendo il busto stabile.",
  },
  {
    name: "Good morning",
    muscleGroup: "Schiena",
    description:
      "Bilanciere sulle spalle, schiena neutra: piega il busto in avanti dall'anca mantenendo le ginocchia leggermente flesse, poi torna eretto spingendo con i glutei.",
  },
  // --- Gambe ---
  {
    name: "Squat bulgaro",
    muscleGroup: "Gambe",
    description:
      "Piede posteriore appoggiato su un rialzo, scendi flettendo il ginocchio anteriore fino a circa 90 gradi, mantenendo il busto eretto.",
  },
  {
    name: "Hack squat",
    muscleGroup: "Gambe",
    description:
      "Alla macchina, schiena e spalle aderenti allo schienale: scendi flettendo le ginocchia fino a circa 90 gradi, poi spingi sui talloni per risalire.",
    sourceUrl: "https://www.projectinvictus.it/hack-squat/",
  },
  {
    name: "Leg extension",
    muscleGroup: "Gambe",
    description:
      "Seduto alla macchina, estendi le ginocchia sollevando il rullo fino a distendere le gambe, poi torna controllando la discesa.",
  },
  {
    name: "Leg curl",
    muscleGroup: "Gambe",
    description:
      "Sdraiato o seduto alla macchina, fletti le ginocchia portando il rullo verso i glutei, poi torna controllando l'estensione.",
  },
  {
    name: "Step up",
    muscleGroup: "Gambe",
    description:
      "Sali su un rialzo con una gamba spingendo sul tallone fino a estendere completamente l'anca, poi torna giu' controllando la discesa.",
  },
  // --- Spalle ---
  {
    name: "Arnold press",
    muscleGroup: "Spalle",
    description:
      "Con i manubri, parti con i palmi rivolti verso di te e ruota i polsi mentre spingi verso l'alto, fino ad avere i palmi in avanti a braccia estese.",
  },
  {
    name: "Alzate laterali",
    muscleGroup: "Spalle",
    description:
      "Manubri ai lati del corpo, solleva le braccia lateralmente fino all'altezza delle spalle, gomiti leggermente flessi, poi controlla la discesa.",
  },
  {
    name: "Alzate frontali",
    muscleGroup: "Spalle",
    description:
      "Manubri davanti alle cosce, solleva le braccia in avanti fino all'altezza delle spalle, senza slanciare.",
  },
  {
    name: "Alzate posteriori",
    muscleGroup: "Spalle",
    description:
      "Busto flesso in avanti, solleva i manubri lateralmente all'indietro concentrandoti sul deltoide posteriore e sulla parte alta della schiena.",
  },
  {
    name: "Scrollate",
    muscleGroup: "Spalle",
    description:
      "Manubri o bilanciere lungo il corpo, solleva le spalle verso le orecchie senza flettere i gomiti, poi rilascia controllando la discesa.",
  },
  // --- Bicipiti ---
  {
    name: "Curl con manubri",
    muscleGroup: "Bicipiti",
    description:
      "Come il curl con bilanciere ma con manubri, alternando o simultaneo, con la possibilita' di ruotare il polso durante la salita.",
  },
  {
    name: "Curl su panca inclinata",
    muscleGroup: "Bicipiti",
    description:
      "Seduto su panca inclinata all'indietro, braccia pendenti: fletti i gomiti mantenendo le spalle ferme contro lo schienale per isolare il bicipite.",
  },
  {
    name: "Curl a martello",
    muscleGroup: "Bicipiti",
    description:
      "Manubri con presa neutra (palmi rivolti l'uno verso l'altro), fletti i gomiti senza ruotare il polso: coinvolge anche il brachiale e l'avambraccio.",
  },
  {
    name: "Spider curl",
    muscleGroup: "Bicipiti",
    description:
      "Busto appoggiato su una panca inclinata a faccia in giu', braccia pendenti: fletti i gomiti isolando il bicipite senza aiuto dello slancio.",
  },
  {
    name: "Curl ai cavi",
    muscleGroup: "Bicipiti",
    description:
      "Al cavo basso, fletti i gomiti mantenendoli fermi ai fianchi, con tensione costante durante tutto il movimento.",
  },
  // --- Tricipiti ---
  {
    name: "Push down",
    muscleGroup: "Tricipiti",
    description:
      "Al cavo alto, gomiti fermi ai fianchi: estendi gli avambracci verso il basso fino a distendere completamente i gomiti.",
  },
  {
    name: "Dip su panche",
    muscleGroup: "Tricipiti",
    description:
      "Mani su una panca dietro di te, piedi appoggiati a terra o su un'altra panca: scendi flettendo i gomiti, poi spingi per risalire.",
  },
  {
    name: "Kick back",
    muscleGroup: "Tricipiti",
    description:
      "Busto flesso in avanti, gomito fermo vicino al fianco: estendi l'avambraccio all'indietro fino a distendere completamente il gomito.",
  },
  {
    name: "Panca a presa stretta",
    muscleGroup: "Tricipiti",
    description:
      "Come la panca piana ma con presa piu' stretta delle spalle, per spostare il lavoro sui tricipiti mantenendo i gomiti vicini al busto durante la discesa.",
  },
  // --- Polpacci ---
  {
    name: "Calf in piedi",
    muscleGroup: "Polpacci",
    description:
      "Alla macchina o con bilanciere, in piedi: solleva i talloni il piu' possibile, poi scendi lentamente sotto il livello di partenza per un allungamento completo.",
  },
  {
    name: "Calf da seduto",
    muscleGroup: "Polpacci",
    description:
      "Seduto alla macchina con il peso sulle ginocchia, solleva i talloni sollevando il carico, poi scendi controllando l'allungamento.",
  },
  // --- Glutei ---
  {
    name: "Hip thrust",
    muscleGroup: "Glutei",
    description:
      "Schiena appoggiata a una panca, bilanciere sul bacino: spingi le anche verso l'alto fino ad allineare tronco, bacino e cosce, contraendo i glutei in alto.",
    sourceUrl: "https://www.projectinvictus.it/hip-thrust-tecnica-ed-accorgimenti/",
  },
  {
    name: "Ponte per i glutei",
    muscleGroup: "Glutei",
    description:
      "A corpo libero, sdraiato a terra con le ginocchia flesse: spingi le anche verso l'alto contraendo i glutei, poi torna giu' controllando la discesa.",
    sourceUrl: "https://www.projectinvictus.it/ponte-glutei-esecuzione-corretta/",
  },
  {
    name: "Slanci ai cavi",
    muscleGroup: "Glutei",
    description:
      "In piedi con la caviglia agganciata al cavo basso, estendi la gamba all'indietro contraendo il gluteo, senza inarcare la schiena.",
  },
  // --- Addome ---
  {
    name: "Crunch",
    muscleGroup: "Addome",
    description:
      "Sdraiato con le ginocchia flesse, mani leggermente dietro la testa: solleva le scapole da terra contraendo l'addome, senza tirare il collo con le mani.",
  },
  {
    name: "Crunch inverso",
    muscleGroup: "Addome",
    description:
      "Sdraiato con le gambe sollevate: porta le ginocchia verso il petto sollevando il bacino da terra, contraendo la parte bassa dell'addome.",
  },
  {
    name: "Plank",
    muscleGroup: "Addome",
    description:
      "Appoggio su avambracci e punte dei piedi, corpo in linea retta dalla testa ai talloni: mantieni la posizione contraendo addome e glutei, senza far cadere il bacino.",
  },
  {
    name: "Plank laterale",
    muscleGroup: "Addome",
    description:
      "Appoggio su un avambraccio e sul lato del piede, corpo in linea retta: mantieni il bacino sollevato contraendo gli obliqui.",
  },
  {
    name: "Sollevamento gambe",
    muscleGroup: "Addome",
    description:
      "Sdraiato con le gambe distese, solleva le gambe fino a circa 90 gradi mantenendo la parte bassa della schiena aderente al pavimento, poi scendi controllando il movimento.",
  },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const update of DESCRIPTION_UPDATES) {
    await sql`UPDATE exercises SET description = ${update.description}, source_url = ${update.sourceUrl ?? null} WHERE name = ${update.name} AND owner_id IS NULL`.execute(
      db
    );
  }
  for (const exercise of NEW_EXERCISES) {
    await sql`INSERT INTO exercises (name, muscle_group, description, source_url, owner_id) VALUES (${exercise.name}, ${exercise.muscleGroup}, ${exercise.description}, ${exercise.sourceUrl ?? null}, NULL)`.execute(
      db
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const names = NEW_EXERCISES.map((e) => e.name);
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ANY(${names})`.execute(db);
  for (const update of DESCRIPTION_UPDATES) {
    await sql`UPDATE exercises SET description = NULL, source_url = NULL WHERE name = ${update.name} AND owner_id IS NULL`.execute(
      db
    );
  }
}
