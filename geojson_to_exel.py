import pandas as pd
import json

# Lue GeoJSON
with open("ski_areas (1).geojson", "r", encoding="utf-8") as f:
    geojson_data = json.load(f)

# Luo lista sanakirjoista, joissa koordinaatit erillisinä sarakkeina
data_list = []
for feature in geojson_data['features']:
    prop = feature['properties']
    geom = feature['geometry']
    if geom['type'] == 'Point':
        prop['longitude'] = geom['coordinates'][0]
        prop['latitude'] = geom['coordinates'][1]
    data_list.append(prop)

# Luo DataFrame ja vie Exceliin
df = pd.DataFrame(data_list)
df.to_excel("geojson_data.xlsx", index=False)
print("GeoJSON viety Exceliin!")
