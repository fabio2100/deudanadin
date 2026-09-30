import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/";
const dbName = process.env.MONGODB_DB ?? "nadinDeuda";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise =
  globalThis._mongoClientPromise ??
  (globalThis._mongoClientPromise = new MongoClient(uri).connect());

export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db(dbName);

  await ensureCollections(db);

  return { client, db };
}

async function ensureCollections(db: ReturnType<MongoClient["db"]>) {
  const collections = await db.listCollections().toArray();
  const existingNames = new Set(collections.map((collection) => collection.name));

  const pagosSchema = {
    $jsonSchema: {
      bsonType: "object",
      required: ["fechaHora", "monto"],
      properties: {
        fechaHora: {
          bsonType: "date",
          description: "Debe ser una fecha y hora válida",
        },
        monto: {
          bsonType: ["number", "decimal"],
          description: "Debe ser un valor numérico con dos decimales",
        },
        descripcion: {
          bsonType: ["string", "null"],
          description: "Descripción opcional del pago; puede ser null",
        },
      },
    },
  };

  const deudasSchema = {
    $jsonSchema: {
      bsonType: "object",
      required: ["fechaHora", "monto", "descripcion"],
      properties: {
        fechaHora: {
          bsonType: "date",
          description: "Debe ser una fecha y hora válida",
        },
        monto: {
          bsonType: "string",
          pattern: "^[0-9]+(\\.[0-9]{2})?$",
          description: "Debe ser un string con valor monetario con dos decimales",
        },
        descripcion: {
          bsonType: ["string", "null"],
          description: "Debe incluir la descripción de la deuda o quedar en null",
        },
        esDolar: {
          bsonType: "bool",
          description: "Indica si la deuda está expresada en dólares",
        },
        cuotaNro: {
          bsonType: ["int", "long", "double", "decimal"],
          description: "Número de cuota, si aplica",
        },
        cuotas: {
          bsonType: ["int", "long", "double", "decimal"],
          description: "Cantidad total de cuotas, si aplica",
        },
      },
    },
  };

  if (!existingNames.has("pagos")) {
    await db.createCollection("pagos", { validator: pagosSchema });
  } else {
    await db.command({ collMod: "pagos", validator: pagosSchema });
  }

  if (!existingNames.has("deudas")) {
    await db.createCollection("deudas", { validator: deudasSchema });
  } else {
    await db.command({ collMod: "deudas", validator: deudasSchema });
  }
}

export { clientPromise, dbName, uri };
