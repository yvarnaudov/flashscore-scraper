import { FileTypes } from "../../constants/index.js";

import { writeJsonToFile, readJsonFromFile } from "../../files/json/index.js";
import { writeCsvToFile } from "../../files/csv/index.js";

export const writeDataToFile = (data, fileName, fileType) => {
  const outputFileName = `${fileName}${fileType.extension}`;

  switch (fileType) {
    case FileTypes.JSON:
    case FileTypes.JSON_ARRAY:
      writeJsonToFile(data, outputFileName, fileType === FileTypes.JSON_ARRAY);
      break;

    case FileTypes.CSV:
      writeCsvToFile(data, outputFileName);
      break;
  }
};

export const readDataFromFile = (fileName, fileType) => {
  switch (fileType) {
    case FileTypes.JSON:
    case FileTypes.JSON_ARRAY:
      return readJsonFromFile(`${fileName}${fileType.extension}`);

    default:
      return {};
  }
};
