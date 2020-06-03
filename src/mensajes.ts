import * as yargs from "yargs";
import * as stream from 'stream';
import * as readline from 'readline';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as dayjs from 'dayjs';
import * as papa from 'papaparse';
import customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const stat = util.promisify(fs.stat);
const exists = util.promisify(fs.exists);
const readdir = util.promisify(fs.readdir);

/*
Ejemplo consulta para obtener los datos:

select
M.fecha, U.fullname, M.mensaje
from CCC_MENSAJEGLOBAL M left join CIS_USER U on M.remitente=U.id
where fecha like '2020%' order by fecha

Acceso con "MySQL Query Browser", con "MySQL Workbench" no funciona por la edad del servidor
*/
async function main(): Promise<number> {
  const argv = yargs
    .example('yarn mensajes --entrada ~/input.csv --salida ~/output.csv', 'Genera un archivo CSV a partir de una ejecución en bbdd')
    .demand('entrada')
    .demand('salida')
    .argv as {
      entrada: string;
      salida: string;
    };

  const inputFile = argv.entrada;
  const outputFile = argv.salida;
  if (!await fileOk(inputFile, true)) {
    return 1;
  }
  if (!await fileOk(outputFile, false)) {
    return 1;
  }
  const output = fs.createWriteStream(outputFile);
  let headersDone = false;

  for await (const entry of parseFile(inputFile)) {
    if (!headersDone) {
      await dumpToCSV(output, papa.unparse({
        fields: getHeaders(),
        data: [entryToArray(entry)]
      }, getPapaOptions()));
      headersDone = true;
    } else {
      await dumpToCSV(output, papa.unparse([entryToArray(entry)], getPapaOptions()));
    }
  }

  output.close();
  console.log(`Generado archivo ${path.resolve(outputFile)}`);
  return 0;
}

async function dumpToCSV(out: stream.Writable, s: string): Promise<void> {
  return new Promise((resolve, reject) => {
    out.write(s + '\n', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function getPapaOptions(): papa.UnparseConfig | undefined {
  return undefined;
}

function getHeaders(): string[] {
  return [
    "Fecha",
    "Autor",
    "Colectivo",
    "Texto"
  ];
}

function entryToArray(entry: EventEntry): unknown[] {
  return [
    entry.date,
    entry.author,
    entry.code || "",
    entry.text
  ];
}

async function fileOk(pathLike: fs.PathLike, mustExist: boolean): Promise<boolean> {
  const e = await exists(pathLike);
  if (e && !mustExist) {
    console.error(`El archivo de salida ${pathLike} ya existe`);
    return false;
  } else if (!e && mustExist) {
    console.error(`El archivo de entrada ${pathLike} no existe`);
    return false;
  }
  return true;
}

interface EventEntry {
  date: string;
  author: string;
  text: string;
  code?: string;
}

async function* parseFile(file: string): AsyncIterableIterator<EventEntry> {
  const parseResult = await new Promise<papa.ParseResult>((resolve, reject) => {
    papa.parse(
      fs.createReadStream(file),
      {
        header: true,
        complete: (results: papa.ParseResult) => { resolve(results); },
        error: (error: papa.ParseError) => { throw new Error('Error parsing file: ' + error.message); }
      }
    );
  });

  const total = parseResult.data.length;
  for (let i = 0; i < total; i++) {
    const item = parseResult.data[i];
    const entry: EventEntry = {
      date: dayjs(item.fecha, "YYYYMMDDHHmmss.SSS").format("YYYY-MM-DDTHH:mm:ss"),
      author: item.fullname,
      text: Buffer.from(item.mensaje, 'base64').toString().trim(),
    };
    if (entry.text) {
      const matches = /.*(\(\d{6}\)).*/g.exec(entry.text);
      if (matches && matches.length > 1) {
        entry.code = matches[1]!.substr(1, 6);
      }
    }
    yield entry;
  }
}

main()
  .then((result: number) => {
    process.exit(result);
  }).catch((e: Error) => {
    if (e.stack) {
      console.error(e.stack);
    }
    console.error(`Error: ${e.message}`);
  });