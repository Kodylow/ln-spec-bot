#!/bin/bash

mkdir -p ../metadata/

for file in ../bips/*.md; do
    echo "Processing ${file}..."
    BIP="$(grep -i '^bip:' "${file}" | awk '{print $2}')"
    LAYER="$(grep -i '^layer:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    TITLE="$(grep -i '^title:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    AUTHOR="$(grep -i '^author:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    COMMENTS_SUMMARY="$(grep -i '^comments-summary:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    COMMENTS_URI="$(grep -i '^comments-uri:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    STATUS="$(grep -i '^status:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    TYPE="$(grep -i '^type:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
    CREATED="$(grep -i '^created:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"

    # Get the filename without the path and extension
    filename=$(basename -- "${file}")
    filename="${filename%.*}"

    cat << EOF > "../metadata/${filename}.json"
{
  "BIP": "${BIP}",
  "Layer": "${LAYER}",
  "Title": "${TITLE}",
  "Author": "${AUTHOR}",
  "Comments-Summary": "${COMMENTS_SUMMARY}",
  "Comments-URI": "${COMMENTS_URI}",
  "Status": "${STATUS}",
  "Type": "${TYPE}",
  "Created": "${CREATED}"
}
EOF
done
