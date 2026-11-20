import { copyFile, mkdir, readdir } from 'node:fs/promises';

const source = new URL('.', import.meta.resolve('morphicons/dom'));
const destination = new URL('../ui/vendor/morphicons/', import.meta.url);
await mkdir(destination, { recursive: true });
const modules = (await readdir(source)).filter((file) =>
  ['dom.js', 'region.js'].includes(file) || /-[A-Z0-9][\w-]{7}\.js$/i.test(file)
);
await Promise.all([
  ...modules.map((file) => copyFile(new URL(file, source), new URL(file, destination))),
  copyFile(new URL('../LICENSE', source), new URL('LICENSE', destination)),
]);
