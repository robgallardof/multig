#!/bin/bash
set -e
cd "$(dirname "$0")"

npm install

if [ ! -d ".next" ]; then
  npm run build
fi

(sleep 4; open "http://localhost:6969") &
npm start
