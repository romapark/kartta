import csv
import json
import requests
import io

# Google Sheets CSV -linkki
csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThmKqPSHyVmucq094HTnClwDkDp2fZi9tgzzVHZTahCKjeS8gNyGXGK5TyGzFTXysn6vsKq09CoBtc/pub?output=csv"

# Ladataan CSV verkosta
response = requests.get(csv_url)
response.raise_for_status()  # varmistaa ettei virhettä tapahdu

# Muutetaan vastaus tiedostomaiseksi objektiksi UTF-8:lla
f = io.StringIO(response.content.decode('utf-8'))
reader = csv.DictReader(f)

data = []
for row in reader:
    # Poistetaan tyhjät solut kokonaan
    clean_row = {k: v for k, v in row.items() if v != ""}

    # Muutetaan boolean-arvot oikein
    for key in clean_row:
        if clean_row[key].lower() == "true":
            clean_row[key] = True
        elif clean_row[key].lower() == "false":
            clean_row[key] = False

    data.append(clean_row)

# Tallennetaan JSON UTF-8:lla ja ilman Unicode-escapeja
json_file = "ski_resorts.json"
with open(json_file, "w", encoding="utf-8") as f_out:
    json.dump(data, f_out, ensure_ascii=False, indent=2)

print(f"CSV muunnettu JSONiksi tiedostoon {json_file}")
