from bs4 import BeautifulSoup
import requests
import re
import json
from datetime import datetime
import time

class BettingOddsScraper:
    def __init__(self):
        self.base_url = 'https://www.betexplorer.com/football/'
        self.leagues = {
            'Champions League': 'europe/champions-league/fixtures/',
            'Premier League': 'england/premier-league/fixtures/',
            'La Liga': 'spain/laliga/fixtures/',
            'Ligue 1': 'france/ligue-1/fixtures/',
            'Bundesliga': 'germany/bundesliga/fixtures/',
            'Serie A': 'italy/serie-a/fixtures/',
            'Eredivisie': 'netherlands/eredivisie/fixtures/',
            'Liga Portugal': 'portugal/liga-portugal/fixtures/',
            'Super Lig': 'turkey/super-lig/fixtures/'
        }
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def get_page_content(self, league_key):
        try:
            url = self.base_url + self.leagues[league_key]
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching data: {e}")
            return None
    
    def parse_fixtures_from_html(self, html_content):
        soup = BeautifulSoup(html_content, 'html.parser')
        fixtures = []
        
        rows = soup.find_all('tr')
        current_date = None
        
        for row in rows:
            match_link = row.find('a', class_='in-match')
            if match_link:
                fixture_data = self.extract_fixture_data(row, current_date)
                if fixture_data:
                    fixtures.append(fixture_data)
                    if fixture_data.get('datetime'):
                        current_date = fixture_data['datetime']
        
        return fixtures
    
    def extract_fixture_data(self, row, current_date):
        try:
            match_link = row.find('a', class_='in-match')
            if not match_link:
                return None
            
            team_spans = match_link.find_all('span')
            if len(team_spans) < 2:
                return None
            
            home_team = team_spans[0].get_text().strip()
            away_team = team_spans[1].get_text().strip()
            
            datetime_cell = row.find('td', class_='table-main__datetime')
            match_datetime = None
            if datetime_cell and datetime_cell.get_text().strip():
                match_datetime = datetime_cell.get_text().strip()
            elif current_date:
                match_datetime = current_date
            
            odds_cells = row.find_all('td', class_='table-main__odds')
            odds = {}
            
            if len(odds_cells) >= 3:
                home_button = odds_cells[0].find('button')
                if home_button:
                    odds['home_win'] = float(home_button.get('data-odd', 0))
                
                draw_button = odds_cells[1].find('button')
                if draw_button:
                    odds['draw'] = float(draw_button.get('data-odd', 0))
                
                away_button = odds_cells[2].find('button')
                if away_button:
                    odds['away_win'] = float(away_button.get('data-odd', 0))
            
            return {
                'datetime': match_datetime,
                'home_team': home_team,
                'away_team': away_team,
                'odds': odds
            }
        
        except Exception as e:
            print(f"Error extracting fixture data: {e}")
            return None
    
    def scrape_league_fixtures(self, league_key):
        print(f"Scraping {league_key.replace('_', ' ').title()}...")
        
        html_content = self.get_page_content(league_key)
        if not html_content:
            return []
        
        fixtures = self.parse_fixtures_from_html(html_content)
        return fixtures
    
    def scrape_all_leagues(self):
        all_fixtures = {}
        
        for league_key in self.leagues.keys():
            try:
                fixtures = self.scrape_league_fixtures(league_key)
                all_fixtures[league_key] = fixtures
                print(f"Found {len(fixtures)} fixtures for {league_key}")
                #time.sleep(0.1)
                
            except Exception as e:
                print(f"Error scraping {league_key}: {e}")
                all_fixtures[league_key] = []
        
        return all_fixtures
    
    def save_to_json(self, data, filename='fixtures.json'):
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Data saved to {filename}")
        except Exception as e:
            print(f"Error saving data: {e}")
    
    def print_fixtures(self, fixtures, league_name=""):
        if league_name:
            print(f"\n=== {league_name.upper()} ===")
        
        for fixture in fixtures:
            print(f"\n🕐 {fixture.get('datetime', 'TBD')}")
            print(f"⚽ {fixture['home_team']} vs {fixture['away_team']}")
            
            odds = fixture.get('odds', {})
            if odds:
                print(f"📊 Odds - Home: {odds.get('home_win', 'N/A')}, "
                      f"Draw: {odds.get('draw', 'N/A')}, "
                      f"Away: {odds.get('away_win', 'N/A')}")


def parse_existing_html_data(html_string):
    html_cleaned = html_string.strip('[]')
    html_parts = html_cleaned.split('>, <')
    
    fixtures = []
    
    for i, part in enumerate(html_parts):
        if 'in-match' in part and 'href=' in part:
            try:
                if not part.startswith('<'):
                    part = '<' + part
                if not part.endswith('>'):
                    part = part + '>'
                
                soup = BeautifulSoup(part, 'html.parser')
                
                spans = soup.find_all('span')
                if len(spans) >= 2:
                    home_team = spans[0].get_text()
                    away_team = spans[1].get_text()
                    
                    odds_data = {}
                    if i + 1 < len(html_parts):
                        next_parts = html_parts[i:i+4]
                        for odds_part in next_parts:
                            if 'data-odd=' in odds_part:
                                match = re.search(r'data-odd="([\d.]+)"', odds_part)
                                if match:
                                    odds_value = float(match.group(1))
                                    if 'home_win' not in odds_data:
                                        odds_data['home_win'] = odds_value
                                    elif 'draw' not in odds_data:
                                        odds_data['draw'] = odds_value
                                    elif 'away_win' not in odds_data:
                                        odds_data['away_win'] = odds_value
                    
                    fixture = {
                        'home_team': home_team,
                        'away_team': away_team,
                        'odds': odds_data
                    }
                    fixtures.append(fixture)
                    
            except Exception as e:
                continue
    
    return fixtures


if __name__ == "__main__":
    scraper = BettingOddsScraper()
    
    all_data = scraper.scrape_all_leagues()
    scraper.save_to_json(all_data, 'fixtures.json')
    
    for league, fixtures in all_data.items():
        scraper.print_fixtures(fixtures, league)