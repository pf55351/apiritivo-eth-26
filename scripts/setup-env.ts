import { copyFile, constants } from 'node:fs/promises';
try {
  await copyFile('.env.example', '.env', constants.COPYFILE_EXCL);
  console.log('Created .env. Set your testnet keys, contract and Bee batch there. No keys were generated.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  console.log('.env already exists; preserved.');
}
