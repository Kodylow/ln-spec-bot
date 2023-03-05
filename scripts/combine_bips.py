import json
import os

# Create the blank dictionary to store all the JSON objects
bips_embeddings = {}

# Get the list of all the files in the folder
file_list = os.listdir('./embeddings/bips')

# Loop through all the files
for file in file_list:

  # Open the file and read the contents
  with open('./embeddings/bips/' + file) as f:
    file_data = json.load(f)

  # Add the contents from the current file into our bips_embeddings
  bips_embeddings.update(file_data)

# Open the file and write to it
with open('bips_embeddings.json', 'w') as outfile:
  json.dump(bips_embeddings, outfile)

# Delete the remaining bips.json files
for file in file_list:
  os.remove('./embeddings/bips/' + file)