import csv
import json
import requests
import io

# Google Sheetsin "CSV" export -linkki (HUOM! pubhtml ei ole CSV!)
csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThmKqPSHyVmucq094HTnClwDkDp2fZi9tgzzVHZTahCKjeS8gNyGXGK5TyGzFTXysn6vsKq09CoBtc/pub?output=csv"

# Ladataan CSV verkosta
response = requests.get(csv_url)
response.raise_for_status()

# Luetaan UTF-8-muodossa
f = io.StringIO(response.content.decode("utf-8"))
reader = csv.DictReader(f)

data = []
for row in reader:
    # Poistetaan None ja tyhjät arvot
    clean_row = {k: v for k, v in row.items() if v not in (None, "")}

    # Muutetaan boolean-arvot oikein
    for key, value in clean_row.items():
        if isinstance(value, str):
            val = value.strip().lower()
            if val == "true":
                clean_row[key] = True
            elif val == "false":
                clean_row[key] = False

    data.append(clean_row)

# Tallennetaan JSON UTF-8:lla
json_file = "ski_resorts.json"
with open(json_file, "w", encoding="utf-8") as f_out:
    json.dump(data, f_out, ensure_ascii=False, indent=2)

print(f"✅ CSV muunnettu JSONiksi tiedostoon {json_file}")