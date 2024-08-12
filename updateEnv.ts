// Import necessary modules
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Path to the .env file
const envPath = path.join(__dirname, '.env');

// Read the environment variables from the .env file
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Function to update or add a new environment variable
export const updateEnvFile = (key: string, value: string) => {
  // Update the existing config object
  envConfig[key] = value;

  // Create a string from the envConfig object
  const updatedEnvContent = Object.keys(envConfig)
    .map((key) => `${key}=${envConfig[key]}`)
    .join('\n\n');

  // Write the updated content back to the .env file
  fs.writeFileSync(envPath, updatedEnvContent);

  console.log(`Updated .env file with ${key}=${value}`);
};
