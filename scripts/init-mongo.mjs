import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/";
const dbName = process.env.MONGODB_DB ?? "nadinDeuda";

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);

  const collections = await db.listCollections().toArray();
  const names = new Set(collections.map((collection) => collection.name));

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

  if (!names.has("pagos")) {
    await db.createCollection("pagos", { validator: pagosSchema });
    console.log("Colección 'pagos' creada.");
  } else {
    await db.command({ collMod: "pagos", validator: pagosSchema });
    console.log("Colección 'pagos' validada.");
  }

  if (!names.has("deudas")) {
    await db.createCollection("deudas", { validator: deudasSchema });
    console.log("Colección 'deudas' creada.");
  } else {
    await db.command({ collMod: "deudas", validator: deudasSchema });
    console.log("Colección 'deudas' validada.");
  }

  console.log(`Base de datos disponible: ${db.databaseName}`);
  console.log(`URI usada: ${uri}`);
} catch (error) {
  console.error("No se pudo crear la base de datos y las colecciones:", error);
  process.exitCode = 1;
} finally {
  await client.close();
}
