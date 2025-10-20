import requests
import json


def parse_int(value):
    try:
        return int(float(value))  # joissain tapauksissa tulee desimaali, esim "3.0"
    except (ValueError, TypeError):
        return None

def parse_float(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# SPARQL-kysely, joka hakee mahdollisimman paljon tietoa laskettelukeskuksista Suomessa
query = """
SELECT ?resort ?resortLabel ?description ?coord ?countryLabel ?locationLabel ?elevation ?numSlopes ?numLifts ?longestSlope ?area ?website ?image ?foundingDate WHERE {
  ?resort wdt:P31 wd:Q130003.  # ski resort
  ?resort wdt:P17 wd:Q16.     # Finland
  
  OPTIONAL { ?resort rdfs:label ?resortLabel FILTER(LANG(?resortLabel)="fi") }
  OPTIONAL { ?resort schema:description ?description FILTER(LANG(?description)="fi") }
  OPTIONAL { ?resort wdt:P625 ?coord. }
  OPTIONAL { ?resort wdt:P17 ?country. }
  OPTIONAL { ?resort wdt:P131 ?location. }         # city / municipality
  OPTIONAL { ?resort wdt:P2044 ?elevation. }       # height above sea level
  OPTIONAL { ?resort wdt:P2013 ?numSlopes. }      # number of slopes
  OPTIONAL { ?resort wdt:P1754 ?numLifts. }       # number of lifts
  OPTIONAL { ?resort wdt:P2048 ?longestSlope. }   # longest slope
  OPTIONAL { ?resort wdt:P2049 ?area. }           # area of skiable terrain
  OPTIONAL { ?resort wdt:P856 ?website. }
  OPTIONAL { ?resort wdt:P18 ?image. }
  OPTIONAL { ?resort wdt:P571 ?foundingDate. }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr". }
}
LIMIT 500
"""

url = "https://query.wikidata.org/sparql"
headers = {"Accept": "application/sparql-results+json"}

print("Haetaan tietoja Wikidatasta...")

response = requests.get(url, headers=headers, params={"query": query})
data = response.json()

resorts = []

for item in data["results"]["bindings"]:
    # Haetaan jokainen kenttä ja tarkistetaan, onko se olemassa
    def get_value(key):
        return item[key]["value"] if key in item else None

    name = get_value("resortLabel")
    desc = get_value("description")
    coord = get_value("coord")
    country = get_value("countryLabel")
    location = get_value("locationLabel")
    elevation = get_value("elevation")
    num_slopes = get_value("numSlopes")
    num_lifts = get_value("numLifts")
    longest_slope = get_value("longestSlope")
    area = get_value("area")
    website = get_value("website")
    image = get_value("image")
    founding_date = get_value("foundingDate")

    lat, lon = None, None
    if coord and coord.startswith("Point("):
        parts = coord.replace("Point(", "").replace(")", "").split(" ")
        lon, lat = float(parts[0]), float(parts[1])

    resorts.append({
        "name": name,
        "description": desc,
        "country": country,
        "location": location,
        "lat": lat,
        "lon": lon,
        "elevation_m": parse_float(elevation),
        "num_slopes": parse_int(num_slopes),
        "num_lifts": parse_int(num_lifts),
        "longest_slope_m": parse_float(longest_slope),
        "area_ha": parse_float(area),
        "website": website,
        "image": image,
        "founding_date": founding_date
    })


# Tallennetaan JSON-tiedostoon
with open("testi_json.json", "w", encoding="utf-8") as f:
    json.dump(resorts, f, ensure_ascii=False, indent=2)

print(f"Tallennettu {len(resorts)} laskettelukeskusta tiedostoon laskettelukeskukset_full.json ✅")
