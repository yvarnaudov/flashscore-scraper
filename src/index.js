import { firefox } from "playwright";
import pLimit from "p-limit";
import chalk from "chalk";

import { OUTPUT_PATH } from "./constants/index.js";
import { parseArguments } from "./cli/arguments/index.js";
import { promptUserOptions } from "./cli/prompts/index.js";
import { start, stop } from "./cli/loader/index.js";
import { initializeProgressbar } from "./cli/progressbar/index.js";

import {
  getMatchLinks,
  getMatchData,
} from "./scraper/services/matches/index.js";

import { writeDataToFile, readDataFromFile } from "./files/handle/index.js";

// Matches in these states won't change anymore, so they are safe to skip.
const FINAL_STATUS = /^(finished|after |awarded|walkover|cancelled|abandoned)/i;
const isAlreadyScraped = (match) =>
  FINAL_STATUS.test(match?.status ?? "") && match?.statistics?.length > 0;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const MAX_RETRIES = 5;
const withRetry = async (fn, retries = MAX_RETRIES) => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    const delay = (MAX_RETRIES + 1 - retries) * 2000;
    console.warn(`⚠️ Retry in ${delay}ms...`);
    await sleep(delay);
    return withRetry(fn, retries - 1);
  }
};

(async () => {
  let browser;
  let context;

  try {
    const cliOptions = parseArguments();

    browser = await firefox.launch({ headless: cliOptions.headless });
    context = await browser.newContext({ locale: "en-US" });

    const { fileName, season, fileType } = await promptUserOptions(
      context,
      cliOptions
    );

    start();

    const matchLinksResults = await getMatchLinks(
      context,
      season?.url,
      "results"
    );
    const matchLinksFixtures = await getMatchLinks(
      context,
      season?.url,
      "fixtures"
    );
    const matchLinks = [...matchLinksFixtures, ...matchLinksResults];

    if (matchLinks.length === 0) {
      throw Error(
        `❌ No matches found on the results page\n` +
          `Please verify that the league name provided is correct`
      );
    }

    stop();

    const matchData = readDataFromFile(fileName, fileType);
    const matchesToScrape = matchLinks.filter(
      ({ id }) => cliOptions.update || !isAlreadyScraped(matchData[id])
    );
    const skipped = matchLinks.length - matchesToScrape.length;
    if (skipped > 0) {
      console.info(
        `⏭️  Skipping ${skipped} already scraped matches (use update=true to re-scrape)`
      );
    }

    if (matchesToScrape.length === 0) {
      console.info("\n✅ Nothing new to scrape, file is up to date\n");
      return;
    }

    const progressbar = initializeProgressbar(matchesToScrape.length);
    const limit = pLimit(cliOptions.concurrency);

    let processedCount = 0;

    const tasks = matchesToScrape.map((matchLink) =>
      limit(async () => {
        const data = await withRetry(() => getMatchData(context, matchLink));
        matchData[matchLink.id] = data;

        processedCount += 1;
        if (processedCount % cliOptions.saveInterval === 0) {
          writeDataToFile(matchData, fileName, fileType);
        }

        progressbar.increment();
      })
    );

    await Promise.all(tasks);

    progressbar.stop();
    writeDataToFile(matchData, fileName, fileType);

    console.info("\n✅ Data collection and file writing completed!");
    console.info(
      `📁 File saved to: ${chalk.cyan(
        `${OUTPUT_PATH}/${fileName}${fileType.extension}`
      )}\n`
    );
  } catch (error) {
    stop();
    if (error.message) console.error(`\n${error.message}\n`);
  } finally {
    await context?.close();
    await browser?.close();
  }
})();
