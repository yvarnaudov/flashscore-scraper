import { openPageAndNavigate, waitForSelectorSafe } from "../../index.js";

const STATISTICS_TIMEOUT = 10_000;

export const getMatchLinks = async (context, leagueSeasonUrl, type) => {
  const page = await openPageAndNavigate(context, `${leagueSeasonUrl}/${type}`);

  const MATCH_SELECTOR = ".event__match.event__match--twoLine";
  const BUTTON_WAIT = 5_000;
  const LOAD_WAIT = 10_000;
  const MAX_EMPTY_CYCLES = 3;

  await waitForSelectorSafe(page, [MATCH_SELECTOR]);

  const loadMoreBtn = page
    .locator("[data-testid='wcl-section-footer'] button", {
      hasText: /show more matches/i,
    })
    .first();

  let emptyCycles = 0;

  while (emptyCycles < MAX_EMPTY_CYCLES) {
    try {
      await loadMoreBtn.waitFor({ state: "visible", timeout: BUTTON_WAIT });
    } catch {
      break;
    }

    const countBefore = await page.locator(MATCH_SELECTOR).count();

    // DOM click avoids failures when the cookie banner overlays the button.
    await loadMoreBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      el.click();
    });

    try {
      await page.waitForFunction(
        ({ selector, count }) =>
          document.querySelectorAll(selector).length > count,
        { selector: MATCH_SELECTOR, count: countBefore },
        { timeout: LOAD_WAIT }
      );
      emptyCycles = 0;
    } catch {
      emptyCycles++;
    }
  }

  const matchIdList = await page.evaluate(() => {
    // Round headers precede their matches in document order.
    let round = null;
    const list = [];
    document
      .querySelectorAll(".event__round, .event__match.event__match--twoLine")
      .forEach((element) => {
        if (element.classList.contains("event__round")) {
          round =
            element.textContent
              .trim()
              .replace(/\s+/g, " ")
              .replace(/^round\s*/i, "") || null;
          return;
        }
        const id = element?.id?.replace("g_1_", "");
        const url = element.querySelector("a.eventRowLink")?.href ?? null;
        list.push({ id, url, round });
      });
    return list;
  });

  await page.close();

  console.info(`✅ Found ${matchIdList.length} matches for ${type}`);
  return matchIdList;
};

export const getMatchData = async (context, { id: matchId, url, round }) => {
  const page = await openPageAndNavigate(context, url);

  try {
    await waitForSelectorSafe(page, [
      ".duelParticipant__startTime",
      "div[data-testid='wcl-summaryMatchInformation'] > div'",
    ]);

    const matchData = await extractMatchData(page);
    const information = await extractMatchInformation(page);

    const statsLink = buildStatsUrl(url);
    await page.goto(statsLink, { waitUntil: "domcontentloaded" });

    await waitForSelectorSafe(
      page,
      ["div[data-testid='wcl-statistics']"],
      STATISTICS_TIMEOUT
    );

    const statistics = await extractMatchStatistics(page);

    return { matchId, round, ...matchData, information, statistics };
  } finally {
    await page.close();
  }
};

const buildStatsUrl = (matchUrl) => {
  if (!matchUrl) return null;

  const url = new URL(matchUrl);
  const base = url.origin + url.pathname.replace(/\/$/, "");
  const mid = url.searchParams.get("mid");

  return `${base}/summary/stats/?mid=${mid}`;
};

const extractMatchData = async (page) => {
  await waitForSelectorSafe(page, [
    "span[data-testid='wcl-scores-overline-03']",
    ".duelParticipant__startTime",
    ".fixedHeaderDuel__detailStatus",
    ".tournamentHeader__country > a",
    ".detailScore__wrapper span:not(.detailScore__divider)",
    ".duelParticipant__home .participant__image",
    ".duelParticipant__away .participant__image",
    ".duelParticipant__home .participant__participantName.participant__overflow",
    ".duelParticipant__away .participant__participantName.participant__overflow",
  ]);

  return await page.evaluate(() => {
    return {
      stage: Array.from(
        document.querySelectorAll("span[data-testid='wcl-scores-overline-03']")
      )?.[2]
        ?.innerText.trim()
        ?.split(" - ")
        .pop()
        .trim(),
      date: document
        .querySelector(".duelParticipant__startTime")
        ?.innerText.trim(),
      status:
        document
          .querySelector(".fixedHeaderDuel__detailStatus")
          ?.innerText.trim() ?? "NOT STARTED",
      home: {
        name: document
          .querySelector(
            ".duelParticipant__home .participant__participantName.participant__overflow"
          )
          ?.innerText.trim(),
        image: document.querySelector(
          ".duelParticipant__home .participant__image"
        )?.src,
      },
      away: {
        name: document
          .querySelector(
            ".duelParticipant__away .participant__participantName.participant__overflow"
          )
          ?.innerText.trim(),
        image: document.querySelector(
          ".duelParticipant__away .participant__image"
        )?.src,
      },
      result: {
        home: Array.from(
          document.querySelectorAll(
            ".detailScore__wrapper span:not(.detailScore__divider)"
          )
        )?.[0]?.innerText.trim(),
        away: Array.from(
          document.querySelectorAll(
            ".detailScore__wrapper span:not(.detailScore__divider)"
          )
        )?.[1]?.innerText.trim(),
        regulationTime: document
          .querySelector(".detailScore__fullTime")
          ?.innerText.trim()
          .replace(/[\n()]/g, ""),
        penalties: Array.from(
          document.querySelectorAll('[data-testid="wcl-scores-overline-02"]')
        )
          .find(
            (element) => element.innerText.trim().toLowerCase() === "penalties"
          )
          ?.nextElementSibling?.innerText?.trim()
          .replace(/\s+/g, ""),
      },
    };
  });
};

const extractMatchInformation = async (page) => {
  return await page.evaluate(async () => {
    const elements = Array.from(
      document.querySelectorAll(
        "div[data-testid='wcl-summaryMatchInformation'] > div"
      )
    );
    return elements.reduce((acc, element, index) => {
      if (index % 2 === 0) {
        acc.push({
          category: element?.textContent
            .trim()
            .replace(/\s+/g, " ")
            .replace(/(^[:\s]+|[:\s]+$|:)/g, ""),
          value: elements[index + 1]?.innerText
            .trim()
            .replace(/\s+/g, " ")
            .replace(/(^[:\s]+|[:\s]+$|:)/g, ""),
        });
      }
      return acc;
    }, []);
  });
};

const extractMatchStatistics = async (page) => {
  return await page.evaluate(async () => {
    return Array.from(
      document.querySelectorAll("div[data-testid='wcl-statistics']")
    ).map((element) => {
      const values = element.querySelectorAll("[class*='wcl-value']");
      return {
        category: element
          .querySelector("[data-testid='wcl-simple-text-01']")
          ?.innerText.trim(),
        homeValue: values[0]?.innerText.trim(),
        awayValue: values[1]?.innerText.trim(),
      };
    });
  });
};
