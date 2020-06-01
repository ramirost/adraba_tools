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

async function main(): Promise<number> {
  const argv = yargs
    .example('yarn c3 --entrada ~/informes_c3 --salida ~/informe_c3_generado.csv', 'Crea informe CSV a partir de archivos de texto')
    .demand('entrada')
    .demand('salida')
    .argv as {
      entrada: string;
      salida: string;
    };

  const inputFolder = argv.entrada;
  const outputFile = argv.salida;
  if (!await folderExists(inputFolder, "entrada")) {
    return 1;
  }
  if (await fileExists(outputFile)) {
    return 1;
  }
  const output = fs.createWriteStream(outputFile);
  let headersDone = false;
  for await (const file of folderFiles(inputFolder)) {
    for await (const entry of parseFile(file)) {
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

async function folderExists(pathLike: fs.PathLike, which: string): Promise<boolean> {
  const e = await exists(pathLike);
  if (!e) {
    console.error(`No existe el directorio de ${which} ${pathLike}`);
    return false;
  }
  const s = await stat(pathLike);
  if (!s.isDirectory()) {
    console.error(`La ruta de ${which} ${pathLike} no es un directorio`);
    return false;
  }
  return true;
}

async function fileExists(pathLike: fs.PathLike): Promise<boolean> {
  const e = await exists(pathLike);
  if (e) {
    console.error(`El archivo de salida ${pathLike} ya existe`);
    return true;
  }
  return false;
}

async function* folderFiles(pathLike: string): AsyncIterableIterator<string> {
  const files = await readdir(pathLike);
  for (let i = 0; i < files.length; i++) {
    const p = path.join(pathLike, files[i]);
    if ((await stat(p)).isFile()) {
      yield p;
    }
  }
}

interface EventEntry {
  date: string;
  author: string;
  text: string;
  code?: string;
}

const FECHA = "Fecha: ";
const AUTOR = "Autor: ";
const EVENTO = "Evento: ";

async function* parseFile(file: string): AsyncIterableIterator<EventEntry> {
  const input: stream.Readable = fs.createReadStream(file);
  const rl = readline.createInterface({ input });
  let currentEntry: Partial<EventEntry> = {};
  for await (const l of rl) {
    const line = l.trim();
    if (line.startsWith(FECHA)) {
      currentEntry.date = dayjs(line.substring(FECHA.length).trim(), "D/M/YY HH:mm").format("YYYY-MM-DDTHH:mm:ss");
    } else if (line.startsWith(AUTOR)) {
      currentEntry.author = line.substring(AUTOR.length);
    } else if (line.startsWith(EVENTO)) {
      currentEntry.text = line.substring(EVENTO.length);
      const matches = /.*(\(\d{6}\)).*/g.exec(currentEntry.text);
      if (matches && matches.length > 1) {
        currentEntry.code = matches[1]!.substr(1, 6);
      }
      yield currentEntry as EventEntry;
      currentEntry = {};
    }
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