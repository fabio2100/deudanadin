import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/";
const dbName = process.env.MONGODB_DB ?? "nadinDeuda";

function parseDate(input) {
  const [day, month, yearText] = input.split("/");
  const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
  return new Date(year, Number(month) - 1, Number(day));
}

function toMongoDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addMonthlySeries(startDateText, description, amount, totalCuotas) {
  const startDate = parseDate(startDateText);
  const monthlyDates = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 2);

  for (let cuota = 1; cuota <= totalCuotas; cuota += 1) {
    monthlyDates.push({
      fechaHora: toMongoDate(cursor),
      descripcion: description,
      monto: String(amount),
      cuotaNro: cuota,
      cuotas: totalCuotas,
      esDolar: false,
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 2);
  }

  return monthlyDates;
}

const records = [
  ...addMonthlySeries("2/11/26", "Plus pet", 29616, 2),
  ...addMonthlySeries("2/10/26", "Pasaje", 20512, 9),
  ...addMonthlySeries("1/10/26", "prestamo", 200000, 7),
];

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("deudas");
  const result = await collection.insertMany(records);
  console.log(`Se insertaron ${result.insertedCount} documentos en la colección 'deudas'.`);

  const docs = await collection.find({}).sort({ fechaHora: 1 }).toArray();
  console.log(JSON.stringify(docs.slice(-records.length), null, 2));
} catch (error) {
  console.error("Error al insertar las deudas adicionales:", error);
  process.exitCode = 1;
} finally {
  await client.close();
}
