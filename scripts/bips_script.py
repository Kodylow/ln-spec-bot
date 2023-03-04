import os
import glob
import re
import json

folder_path = "../bips"
metadata_dir = "../metadata"

# Create the metadata directory if it doesn't exist
if not os.path.exists(metadata_dir):
    os.makedirs(metadata_dir)

for filename in glob.iglob(folder_path + "/**/*.md", recursive=True):
    with open(filename, "r") as file:
        contents = file.read()

    # Extract the metadata section from the contents
    match = re.search("(?s)^(.*?)\n\n", contents)
    if match:
        metadata_str = match.group(1).strip()
    else:
        metadata_str = ""

    # Parse the metadata string into a dictionary
    metadata_dict = {}
    for line in metadata_str.split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            metadata_dict[key.strip()] = value.strip()

    # Create a new filename with the same name as the markdown file, but with a .json extension
    json_filename = os.path.join(metadata_dir, os.path.basename(os.path.splitext(filename)[0] + ".json"))

    # Serialize the metadata to a JSON string
    metadata_json = json.dumps(metadata_dict, indent=2)

    # Write the JSON string to the new file
    with open(json_filename, "w") as file:
        file.write(metadata_json)
