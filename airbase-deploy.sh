#!/bin/bash
set -e
cd "$(dirname "$0")"

airbase container build --file Dockerfile
airbase container deploy --yes "$@"
