#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SHL ICS Parser
Parsar ICS-filen från SHL och skapar matches.csv för Airtable-import
"""

import re
from datetime import datetime
import csv

def parse_ics_file(filename):
    """Parsar ICS-filen och extraherar matchinformation"""
    matches = []
    current_event = {}
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Dela upp i events
    events = content.split('BEGIN:VEVENT')[1:]  # Skippa första delen
    
    for event in events:
        if 'END:VEVENT' not in event:
            continue
            
        # Extrahera relevanta fält
        match_info = {}
        
        # Datum och tid (DTSTART)
        dtstart_match = re.search(r'DTSTART:(\d{8}T\d{6}Z)', event)
        if dtstart_match:
            dt_str = dtstart_match.group(1)
            # Konvertera från UTC till svensk tid (CET/CEST)
            dt = datetime.strptime(dt_str, '%Y%m%dT%H%M%SZ')
            match_info['date'] = dt.strftime('%Y-%m-%d')
            match_info['time'] = dt.strftime('%H:%M')
        
        # Slutdatum (DTEND)
        dtend_match = re.search(r'DTEND:(\d{8}T\d{6}Z)', event)
        if dtend_match:
            dt_str = dtend_match.group(1)
            dt = datetime.strptime(dt_str, '%Y%m%dT%H%M%SZ')
            match_info['end_time'] = dt.strftime('%H:%M')
        
        # Matchlag från SUMMARY
        summary_match = re.search(r'SUMMARY:🏒 SHL \| ([^-]+) - (.+)', event)
        if summary_match:
            home_team = summary_match.group(1).strip()
            away_team = summary_match.group(2).strip()
            match_info['home_team'] = home_team
            match_info['away_team'] = away_team
        
        # Arena från LOCATION
        location_match = re.search(r'LOCATION:(.+)', event)
        if location_match:
            match_info['arena'] = location_match.group(1).strip()
        
        # UID för unik identifiering
        uid_match = re.search(r'UID:([^@]+)@', event)
        if uid_match:
            match_info['uid'] = uid_match.group(1)
        
        # Lägg till om vi har all nödvändig information
        if all(key in match_info for key in ['date', 'time', 'home_team', 'away_team']):
            matches.append(match_info)
    
    return matches

def normalize_team_name(team_name):
    """Normaliserar lagnamn för att matcha vår teams.csv"""
    team_mapping = {
        'HV71': 'HV71',
        'Frölunda HC': 'Frölunda HC',
        'Malmö Redhawks': 'Malmö Redhawks',
        'Färjestad BK': 'Färjestad BK',
        'Luleå Hockey': 'Luleå Hockey',
        'Växjö Lakers': 'Växjö Lakers',
        'Djurgården Hockey': 'Djurgården Hockey',
        'Brynäs IF': 'Brynäs IF',
        'Linköping HC': 'Linköping HC',
        'Örebro Hockey': 'Örebro Hockey',
        'Rögle BK': 'Rögle BK',
        'Skellefteå AIK': 'Skellefteå AIK',
        'Timrå IK': 'Timrå IK',
        'Leksands IF': 'Leksands IF'
    }
    
    return team_mapping.get(team_name, team_name)

def create_matches_csv(matches, filename='/Volumes/home/Kodning/SHL-V2/matches.csv'):
    """Skapar CSV-fil med alla matcher för Airtable-import"""
    
    # Sortera matcher efter datum
    matches.sort(key=lambda x: x['date'])
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'match_id',
            'date', 
            'time',
            'home_team',
            'away_team', 
            'arena',
            'home_goals',
            'away_goals',
            'status',
            'round',
            'season'
        ]
        
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for i, match in enumerate(matches, 1):
            # Normalisera lagnamn
            home_team = normalize_team_name(match['home_team'])
            away_team = normalize_team_name(match['away_team'])
            
            # Bestäm runda baserat på datum (preliminärt)
            date_obj = datetime.strptime(match['date'], '%Y-%m-%d')
            if date_obj.month >= 9:  # September eller senare
                round_num = ((date_obj - datetime(date_obj.year, 9, 1)).days // 7) + 1
            else:  # Januari-augusti nästa år
                round_num = ((date_obj - datetime(date_obj.year - 1, 9, 1)).days // 7) + 1
            
            writer.writerow({
                'match_id': f'SHL_{match.get("uid", str(i))}',
                'date': match['date'],
                'time': match['time'],
                'home_team': home_team,
                'away_team': away_team,
                'arena': match.get('arena', ''),
                'home_goals': '',  # Tomt - fylls i när matcher spelas
                'away_goals': '',  # Tomt - fylls i när matcher spelas
                'status': 'Scheduled',  # Alla matcher är schemalagda initialt
                'round': min(round_num, 52),  # Max 52 rundor
                'season': '2024-2025'
            })
    
    return len(matches)

if __name__ == '__main__':
    print("Parsar SHL ICS-fil...")
    matches = parse_ics_file('/Volumes/home/Kodning/SHL-V2/SHL_251026.ics')
    print(f"Hittade {len(matches)} matcher")
    
    if matches:
        count = create_matches_csv(matches)
        print(f"Skapade matches.csv med {count} matcher")
        
        # Visa första 5 matcherna som exempel
        print("\nFörsta 5 matcherna:")
        for i, match in enumerate(matches[:5], 1):
            print(f"{i}. {match['date']} {match['time']} - {match['home_team']} vs {match['away_team']} ({match.get('arena', 'Ingen arena')})")
    else:
        print("Inga matcher hittades!")