#!/bin/bash

mkdir -p ../metadata/

for file in ../bips/*.md; do
  echo "Processing ${file}..."
  BIP="$(grep -i '^bip:' "${file}" | awk '{print $2}')"
  BIP_PREFIX="$(printf "bip-%04d" "${BIP#0}")"
  LAYER="$(grep -i '^layer:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  TITLE="$(grep -i '^title:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  AUTHOR="$(grep -i '^author:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  COMMENTS_SUMMARY="$(grep -i '^comments-summary:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  COMMENTS_URI="$(grep -i '^comments-uri:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  STATUS="$(grep -i '^status:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  TYPE="$(grep -i '^type:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"
  CREATED="$(grep -i '^created:' "${file}" | awk '{$1="";print$0}' | sed 's/^ *//g')"

  cat <<EOF >"../metadata/${BIP_PREFIX}.json"
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
