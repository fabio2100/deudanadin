import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/";
const dbName = process.env.MONGODB_DB ?? "nadinDeuda";

function parseDayMonthYear(dateText) {
  const [day, month, yearText] = dateText.split("/");
  const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
  return new Date(year, Number(month) - 1, Number(day));
}

function getSecondDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 2);
}

function formatDateForMongo(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("deudas");

  const initialRecords = [
    {
      fechaHora: formatDateForMongo(parseDayMonthYear("2/10/26")),
      descripcion: "Arjona",
      monto: "33333",
      cuotaNro: 1,
      cuotas: 2,
      esDolar: false,
    },
    {
      fechaHora: formatDateForMongo(parseDayMonthYear("2/11/26")),
      descripcion: "Arjona",
      monto: "33333",
      cuotaNro: 2,
      cuotas: 2,
      esDolar: false,
    },
  ];

  await collection.insertMany(initialRecords);

  const cuotasSeries = [];
  let cursorDate = parseDayMonthYear("2/11/26");

  for (let cuotaNro = 1; cuotaNro <= 11; cuotaNro += 1) {
    cuotasSeries.push({
      fechaHora: formatDateForMongo(getSecondDayOfMonth(cursorDate)),
      descripcion: "cubiertas",
      monto: "22900",
      cuotaNro,
      cuotas: 11,
      esDolar: false,
    });

    cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 2);
  }

  await collection.insertMany(cuotasSeries);

  const count = await collection.countDocuments();
  console.log(`Se insertaron ${count} documentos en la colección 'deudas'.`);
  console.log("Primeros registros:");
  const docs = await collection.find({}).sort({ fechaHora: 1 }).toArray();
  console.log(JSON.stringify(docs, null, 2));
} catch (error) {
  console.error("Error al insertar los registros:", error);
  process.exitCode = 1;
} finally {
  await client.close();
}
