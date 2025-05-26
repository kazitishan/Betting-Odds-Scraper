const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class BettingOddsScraper {
    constructor() {
        this.baseUrl = 'https://www.betexplorer.com/football/';
        this.leagues = {
            'Champions League': 'europe/champions-league/fixtures/',
            'Premier League': 'england/premier-league/fixtures/',
            'La Liga': 'spain/laliga/fixtures/',
            'Ligue 1': 'france/ligue-1/fixtures/',
            'Bundesliga': 'germany/bundesliga/fixtures/',
            'Serie A': 'italy/serie-a/fixtures/',
            'Eredivisie': 'netherlands/eredivisie/fixtures/',
            'Liga Portugal': 'portugal/liga-portugal/fixtures/',
            'Super Lig': 'turkey/super-lig/fixtures/'
        };
        this.browser = null;
        this.page = null;
    }

    async initBrowser() {
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ]
            });
            this.page = await this.browser.newPage();
            
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await this.page.setViewport({ width: 1920, height: 1080 });
            
        } catch (error) {
            console.error(`Error initializing browser: ${error}`);
            throw error;
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async getPageContent(leagueKey) {
        try {
            const url = this.baseUrl + this.leagues[leagueKey];
            console.log(`Navigating to: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            await this.page.waitForSelector('tr', { timeout: 10000 });
            
            return await this.page.content();
            
        } catch (error) {
            console.error(`Error fetching data for ${leagueKey}: ${error}`);
            return null;
        }
    }

    async parseFixturesFromPage(leagueKey) {
        try {
            const url = this.baseUrl + this.leagues[leagueKey];
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            try {
                await this.page.waitForSelector('tr', { timeout: 5000 });
            } catch (timeoutError) {
                console.log(`No fixtures found for ${leagueKey} (no table rows present)`);
                return [];
            }

            const fixtures = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('tr');
                const fixturesData = [];
                let currentDate = null;

                rows.forEach(row => {
                    const matchLink = row.querySelector('a.in-match');
                    if (matchLink) {
                        const fixtureData = this.extractFixtureDataFromRow(row, currentDate);
                        if (fixtureData) {
                            fixturesData.push(fixtureData);
                            if (fixtureData.datetime) {
                                currentDate = fixtureData.datetime;
                            }
                        }
                    }
                });

                return fixturesData;
            });

            return fixtures;

        } catch (error) {
            console.error(`Error parsing fixtures for ${leagueKey}: ${error}`);
            return [];
        }
    }

    static extractFixtureDataFromRow(row, currentDate) {
        try {
            const matchLink = row.querySelector('a.in-match');
            if (!matchLink) return null;

            const teamSpans = matchLink.querySelectorAll('span');
            if (teamSpans.length < 2) return null;

            const homeTeam = teamSpans[0].textContent.trim();
            const awayTeam = teamSpans[1].textContent.trim();

            const datetimeCell = row.querySelector('td.table-main__datetime');
            let matchDatetime = null;
            if (datetimeCell && datetimeCell.textContent.trim()) {
                matchDatetime = datetimeCell.textContent.trim();
            } else if (currentDate) {
                matchDatetime = currentDate;
            }

            const oddsCells = row.querySelectorAll('td.table-main__odds');
            const odds = {};

            if (oddsCells.length >= 3) {
                const homeButton = oddsCells[0].querySelector('button');
                if (homeButton) {
                    const homeOdd = homeButton.getAttribute('data-odd');
                    if (homeOdd) odds.home_win = parseFloat(homeOdd);
                }

                const drawButton = oddsCells[1].querySelector('button');
                if (drawButton) {
                    const drawOdd = drawButton.getAttribute('data-odd');
                    if (drawOdd) odds.draw = parseFloat(drawOdd);
                }

                const awayButton = oddsCells[2].querySelector('button');
                if (awayButton) {
                    const awayOdd = awayButton.getAttribute('data-odd');
                    if (awayOdd) odds.away_win = parseFloat(awayOdd);
                }
            }

            return {
                datetime: matchDatetime,
                home_team: homeTeam,
                away_team: awayTeam,
                odds: odds
            };

        } catch (error) {
            console.error(`Error extracting fixture data: ${error}`);
            return null;
        }
    }

    async scrapeLeagueFixtures(leagueKey) {
        console.log(`Scraping ${leagueKey.replace('_', ' ')}...`);
        
        try {
            const url = this.baseUrl + this.leagues[leagueKey];
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            try {
                await this.page.waitForSelector('tr', { timeout: 5000 });
            } catch (timeoutError) {
                console.log(`No fixtures found for ${leagueKey} (no table rows present)`);
                return [];
            }

            const fixtures = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('tr');
                const fixturesData = [];
                let currentDate = null;

                const extractFixtureDataFromRow = (row, currentDate) => {
                    try {
                        const matchLink = row.querySelector('a.in-match');
                        if (!matchLink) return null;

                        const teamSpans = matchLink.querySelectorAll('span');
                        if (teamSpans.length < 2) return null;

                        const homeTeam = teamSpans[0].textContent.trim();
                        const awayTeam = teamSpans[1].textContent.trim();

                        const datetimeCell = row.querySelector('td.table-main__datetime');
                        let matchDatetime = null;
                        if (datetimeCell && datetimeCell.textContent.trim()) {
                            matchDatetime = datetimeCell.textContent.trim();
                        } else if (currentDate) {
                            matchDatetime = currentDate;
                        }

                        const oddsCells = row.querySelectorAll('td.table-main__odds');
                        const odds = {};

                        if (oddsCells.length >= 3) {
                            const homeButton = oddsCells[0].querySelector('button');
                            if (homeButton) {
                                const homeOdd = homeButton.getAttribute('data-odd');
                                if (homeOdd) odds.home_win = parseFloat(homeOdd);
                            }

                            const drawButton = oddsCells[1].querySelector('button');
                            if (drawButton) {
                                const drawOdd = drawButton.getAttribute('data-odd');
                                if (drawOdd) odds.draw = parseFloat(drawOdd);
                            }

                            const awayButton = oddsCells[2].querySelector('button');
                            if (awayButton) {
                                const awayOdd = awayButton.getAttribute('data-odd');
                                if (awayOdd) odds.away_win = parseFloat(awayOdd);
                            }
                        }

                        return {
                            datetime: matchDatetime,
                            home_team: homeTeam,
                            away_team: awayTeam,
                            odds: odds
                        };

                    } catch (error) {
                        console.error(`Error extracting fixture data: ${error}`);
                        return null;
                    }
                };

                rows.forEach(row => {
                    const matchLink = row.querySelector('a.in-match');
                    if (matchLink) {
                        const fixtureData = extractFixtureDataFromRow(row, currentDate);
                        if (fixtureData) {
                            fixturesData.push(fixtureData);
                            if (fixtureData.datetime) {
                                currentDate = fixtureData.datetime;
                            }
                        }
                    }
                });

                return fixturesData;
            });

            return fixtures;

        } catch (error) {
            console.error(`Error scraping ${leagueKey}: ${error}`);
            return [];
        }
    }

    async scrapeAllLeagues() {
        const allFixtures = {};
        
        for (const leagueKey of Object.keys(this.leagues)) {
            try {
                const fixtures = await this.scrapeLeagueFixtures(leagueKey);
                allFixtures[leagueKey] = fixtures;
                console.log(`Found ${fixtures.length} fixtures for ${leagueKey}`);
                
            } catch (error) {
                console.error(`Error scraping ${leagueKey}: ${error}`);
                allFixtures[leagueKey] = [];
            }
        }
        
        return allFixtures;
    }

    async saveToJson(data, filename = 'fixtures.json') {
        try {
            await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Data saved to ${filename}`);
        } catch (error) {
            console.error(`Error saving data: ${error}`);
        }
    }

    printFixtures(fixtures, leagueName = "") {
        if (leagueName) {
            console.log(`\n=== ${leagueName.toUpperCase()} ===`);
        }
        
        fixtures.forEach(fixture => {
            console.log(`\n🕐 ${fixture.datetime || 'TBD'}`);
            console.log(`⚽ ${fixture.home_team} vs ${fixture.away_team}`);
            
            const odds = fixture.odds || {};
            if (Object.keys(odds).length > 0) {
                console.log(`📊 Odds - Home: ${odds.home_win || 'N/A'}, ` +
                          `Draw: ${odds.draw || 'N/A'}, ` +
                          `Away: ${odds.away_win || 'N/A'}`);
            }
        });
    }
}

function parseExistingHtmlData(htmlString) {
    const cheerio = require('cheerio');
    const fixtures = [];
    
    try {
        const $ = cheerio.load(htmlString);
        
        $('a.in-match').each((index, element) => {
            try {
                const spans = $(element).find('span');
                if (spans.length >= 2) {
                    const homeTeam = $(spans[0]).text().trim();
                    const awayTeam = $(spans[1]).text().trim();
                    
                    const oddsData = {};
                    const row = $(element).closest('tr');
                    const oddsButtons = row.find('button[data-odd]');
                    
                    if (oddsButtons.length >= 3) {
                        oddsData.home_win = parseFloat($(oddsButtons[0]).attr('data-odd')) || null;
                        oddsData.draw = parseFloat($(oddsButtons[1]).attr('data-odd')) || null;
                        oddsData.away_win = parseFloat($(oddsButtons[2]).attr('data-odd')) || null;
                    }
                    
                    const fixture = {
                        home_team: homeTeam,
                        away_team: awayTeam,
                        odds: oddsData
                    };
                    
                    fixtures.push(fixture);
                }
            } catch (error) {
            }
        });
        
    } catch (error) {
        console.error(`Error parsing HTML data: ${error}`);
    }
    
    return fixtures;
}

async function main() {
    const scraper = new BettingOddsScraper();
    
    try {
        await scraper.initBrowser();
        
        const allData = await scraper.scrapeAllLeagues();
        await scraper.saveToJson(allData, 'fixtures.json');
        
        for (const [league, fixtures] of Object.entries(allData)) {
            scraper.printFixtures(fixtures, league);
        }
        
    } catch (error) {
        console.error(`Main execution error: ${error}`);
    } finally {
        await scraper.closeBrowser();
    }
}

module.exports = {
    BettingOddsScraper,
    parseExistingHtmlData,
    main
};

if (require.main === module) {
    main().catch(console.error);
}