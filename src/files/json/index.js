import fs from "fs";
import path from "path";

import { OUTPUT_PATH } from "../../constants/index.js";

export const writeJsonToFile = (data, fileName, asArray) => {
  const preparedData = asArray ? toArray(data) : data;

  const filePath = path.join(OUTPUT_PATH, fileName);
  const fileContent = JSON.stringify(preparedData, null, 2);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fileContent, "utf-8");
  } catch (error) {
    throw Error(`❌ Failed to create directories or write the JSON file`);
  }
};

const toArray = (data) =>
  Object.entries(data).map(([matchId, matchData]) => ({
    matchId,
    ...structuredClone(matchData),
  }));

export const readJsonFromFile = (fileName) => {
  const filePath = path.join(OUTPUT_PATH, fileName);
  if (!fs.existsSync(filePath)) return {};

  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(content)) return content;

    return Object.fromEntries(
      content.map(({ matchId, ...matchData }) => [matchId, matchData])
    );
  } catch {
    throw Error(
      `❌ Failed to read existing data from ${filePath}\n` +
        `Fix or remove the file and run again`
    );
  }
};
